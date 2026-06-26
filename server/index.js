import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, relative, sep } from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { createProxyRecord, getProxyRecord, pruneProxyRecords } from './proxy-store.js';
import {
  extractPlaybackRequestProxyId,
  normalizeUpstreamPlaybackMessage,
  rewriteClientPlaybackMessage
} from './proxy-url.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || '8080');
const rootDir = process.cwd();
const publicDir = join(rootDir, 'public');
const sdkDir = join(rootDir, 'vendor', 'video-sdk');
const bridgeStates = new WeakMap();
const debugProxy = process.env.DEBUG_PROXY === '1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function contentType(pathname) {
  const match = pathname.match(/\.[^.]+$/);
  return match ? mimeTypes[match[0]] || 'application/octet-stream' : 'application/octet-stream';
}

function safeJoin(baseDir, requestPath) {
  let cleanPath;
  try {
    cleanPath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  } catch {
    return null;
  }

  const filePath = join(baseDir, cleanPath);
  const rel = relative(baseDir, filePath);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) {
    return null;
  }
  return filePath;
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function staticResponse(req, res, baseDir, requestPath) {
  const filePath = safeJoin(baseDir, requestPath);
  if (!filePath || !existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  const stat = statSync(filePath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    sendText(res, 404, 'Not found');
    return;
  }

  res.writeHead(200, {
    'cache-control': 'no-cache',
    'content-type': contentType(filePath),
    'content-length': stat.size
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

function parseProxyIdFromRequest(url) {
  return extractPlaybackRequestProxyId(url);
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendUpstream(state, payload) {
  if (debugProxy) {
    console.log('[proxy] client -> upstream', describePayload(payload));
  }

  if (state.upstream && state.upstreamOpen) {
    state.upstream.send(payload);
    return;
  }

  state.pending.push(payload);
}

function describePayload(payload) {
  if (typeof payload === 'string') {
    return { type: 'string', length: payload.length, preview: payload.slice(0, 500) };
  }
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  return { type: 'buffer', length: buffer.byteLength, preview: buffer.toString('utf8', 0, Math.min(buffer.byteLength, 500)) };
}

function connectUpstream(ws, state, record) {
  const upstream = new WebSocket(record.upstreamConnectUrl, {
    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
  });
  state.upstream = upstream;

  upstream.binaryType = 'arraybuffer';

  upstream.on('open', () => {
    if (debugProxy) {
      console.log('[proxy] upstream open', record.upstreamConnectUrl);
    }

    state.upstreamOpen = true;
    const pending = state.pending.splice(0);
    for (const item of pending) {
      upstream.send(item);
    }
  });

  upstream.on('message', (data, isBinary) => {
    const payload = normalizeUpstreamPlaybackMessage(data, isBinary);
    if (debugProxy) {
      console.log('[proxy] upstream -> client', { isBinary, payload: describePayload(payload) });
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });

  upstream.on('error', (error) => {
    if (debugProxy) {
      console.log('[proxy] upstream error', error.message);
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, 'Upstream websocket error');
    }
  });

  upstream.on('close', (code, reason) => {
    if (debugProxy) {
      console.log('[proxy] upstream close', code, reason.toString());
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
}

async function handleProxyUrl(req, res, requestUrl) {
  let body;
  try {
    body = await readRequestJson(req);
  } catch {
    sendJson(res, { error: 'Request body must be JSON.' }, 400);
    return;
  }

  if (!body.url || typeof body.url !== 'string') {
    sendJson(res, { error: 'Field `url` is required.' }, 400);
    return;
  }

  try {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const secure = forwardedProto ? forwardedProto === 'https' : requestUrl.protocol === 'https:';
    const record = createProxyRecord(body.url, req.headers.host || `${host}:${port}`, secure);
    sendJson(res, {
      id: record.id,
      playUrl: record.localUrl,
      sessionID: record.id,
      expiresAt: record.expiresAt
    });
  } catch (error) {
    sendJson(res, { error: error instanceof Error ? error.message : String(error) }, 400);
  }
}

const pruneTimer = setInterval(pruneProxyRecords, 60_000);
pruneTimer.unref?.();

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);

  if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(res, { ok: true });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/proxy-url') {
    await handleProxyUrl(req, res, requestUrl);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed');
    return;
  }

  if (requestUrl.pathname === '/' || requestUrl.pathname === '/test-hik-video.html') {
    staticResponse(req, res, publicDir, 'test-hik-video.html');
    return;
  }

  if (requestUrl.pathname.startsWith('/video-sdk/')) {
    staticResponse(req, res, sdkDir, requestUrl.pathname.replace(/^\/video-sdk\//, ''));
    return;
  }

  staticResponse(req, res, publicDir, requestUrl.pathname.replace(/^\//, ''));
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  const proxyId = parseProxyIdFromRequest(requestUrl);

  if (!proxyId || !getProxyRecord(proxyId)) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nUnknown or expired proxy session.');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.proxyId = proxyId;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const record = ws.proxyId ? getProxyRecord(ws.proxyId) : null;
  const state = {
    record,
    upstream: null,
    upstreamOpen: false,
    pending: []
  };
  bridgeStates.set(ws, state);

  if (!record) {
    ws.close(1008, 'Unknown proxy session.');
    return;
  }

  if (debugProxy) {
    console.log('[proxy] client open', { id: record.id, upstreamConnectUrl: record.upstreamConnectUrl, upstreamPlayURL: record.upstreamPlayURL });
  }

  connectUpstream(ws, state, record);

  ws.on('message', (message, isBinary) => {
    const currentState = bridgeStates.get(ws);
    if (!currentState?.record) {
      ws.close(1008, 'Unknown proxy session.');
      return;
    }

    const rewritten = rewriteClientPlaybackMessage(currentState.record, message, isBinary);
    if (debugProxy) {
      console.log('[proxy] client raw', { isBinary, payload: describePayload(message) });
    }
    sendUpstream(currentState, rewritten);
  });

  ws.on('close', (code, reason) => {
    if (debugProxy) {
      console.log('[proxy] client close', code, reason.toString());
    }

    const currentState = bridgeStates.get(ws);
    if (currentState?.upstream && currentState.upstream.readyState === WebSocket.OPEN) {
      currentState.upstream.close();
    }
    bridgeStates.delete(ws);
  });
});

server.listen(port, host, () => {
  console.log(`Node video proxy server listening on http://${host}:${port}`);
});
