import { existsSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';
import { createProxyRecord, getProxyRecord, pruneProxyRecords, type ProxyRecord } from './proxy-store';
import { extractProxyId } from './proxy-url';

type ServerWebSocket = Parameters<NonNullable<Parameters<typeof Bun.serve>[0]['websocket']>['open']>[0];

type WebSocketData = {
  proxyId: string | null;
};

type BridgeState = {
  record: ProxyRecord | null;
  upstream: WebSocket | null;
  upstreamOpen: boolean;
  pending: Array<string | ArrayBuffer | Uint8Array>;
};

const host = Bun.env.HOST || '127.0.0.1';
const port = Number(Bun.env.PORT || '8080');
const rootDir = process.cwd();
const publicDir = join(rootDir, 'public');
const sdkDir = join(rootDir, 'vendor', 'video-sdk');
const bridgeStates = new WeakMap<ServerWebSocket, BridgeState>();

const mimeTypes: Record<string, string> = {
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

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });
}

function contentType(pathname: string): string {
  const match = pathname.match(/\.[^.]+$/);
  return match ? mimeTypes[match[0]] || 'application/octet-stream' : 'application/octet-stream';
}

function safeJoin(baseDir: string, requestPath: string): string | null {
  const cleanPath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(baseDir, cleanPath);
  const rel = relative(baseDir, filePath);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) {
    return null;
  }
  return filePath;
}

function staticResponse(baseDir: string, requestPath: string): Response {
  const filePath = safeJoin(baseDir, requestPath);
  if (!filePath || !existsSync(filePath)) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(Bun.file(filePath), {
    headers: {
      'cache-control': 'no-cache',
      'content-type': contentType(filePath)
    }
  });
}

function parseProxyIdFromRequest(url: URL): string | null {
  return url.searchParams.get('sessionID') || url.searchParams.get('session') || null;
}

function sendUpstream(state: BridgeState, payload: string | ArrayBuffer | Uint8Array): void {
  if (state.upstream && state.upstreamOpen) {
    state.upstream.send(payload);
    return;
  }

  state.pending.push(payload);
}

function normalizePayload(payload: string | Buffer): string | ArrayBuffer | Uint8Array {
  if (typeof payload === 'string') {
    return payload;
  }
  return payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
}

function rewriteClientMessage(record: ProxyRecord, message: string | Buffer): string | ArrayBuffer | Uint8Array {
  if (typeof message !== 'string') {
    return normalizePayload(message);
  }

  try {
    const parsed = JSON.parse(message);
    if (typeof parsed.url === 'string') {
      const proxyId = extractProxyId(parsed.url);
      if (proxyId === record.id) {
        parsed.url = record.upstreamPlayURL;
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return message;
  }
}

function connectUpstream(ws: ServerWebSocket, state: BridgeState, record: ProxyRecord): void {
  const upstream = new WebSocket(record.upstreamConnectUrl);
  state.upstream = upstream;

  upstream.binaryType = 'arraybuffer';

  upstream.onopen = () => {
    state.upstreamOpen = true;
    const pending = state.pending.splice(0);
    for (const item of pending) {
      upstream.send(item);
    }
  };

  upstream.onmessage = (event) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(event.data as string | ArrayBuffer);
    }
  };

  upstream.onerror = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, 'Upstream websocket error');
    }
  };

  upstream.onclose = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}

async function handleProxyUrl(request: Request): Promise<Response> {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return json({ error: 'Field `url` is required.' }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const secure = forwardedProto ? forwardedProto === 'https' : url.protocol === 'https:';
    const record = createProxyRecord(body.url, request.headers.get('host') || `${host}:${port}`, secure);
    return json({
      id: record.id,
      playUrl: record.localUrl,
      sessionID: record.id,
      expiresAt: record.expiresAt
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

setInterval(pruneProxyRecords, 60_000).unref?.();

const server = Bun.serve<WebSocketData>({
  hostname: host,
  port,
  async fetch(request, server) {
    const url = new URL(request.url);

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const proxyId = parseProxyIdFromRequest(url);
      if (!proxyId || !getProxyRecord(proxyId)) {
        return new Response('Unknown or expired proxy session.', { status: 404 });
      }

      const upgraded = server.upgrade(request, { data: { proxyId } });
      return upgraded ? undefined : new Response('WebSocket upgrade failed.', { status: 500 });
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/api/proxy-url') {
      return handleProxyUrl(request);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (url.pathname === '/' || url.pathname === '/test-hik-video.html') {
      return staticResponse(publicDir, 'test-hik-video.html');
    }

    if (url.pathname.startsWith('/video-sdk/')) {
      return staticResponse(sdkDir, url.pathname.replace(/^\/video-sdk\//, ''));
    }

    return staticResponse(publicDir, url.pathname.replace(/^\//, ''));
  },
  websocket: {
    open(ws) {
      const record = ws.data.proxyId ? getProxyRecord(ws.data.proxyId) : null;
      const state: BridgeState = {
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

      connectUpstream(ws, state, record);
    },
    message(ws, message) {
      const state = bridgeStates.get(ws);
      if (!state?.record) {
        ws.close(1008, 'Unknown proxy session.');
        return;
      }

      sendUpstream(state, rewriteClientMessage(state.record, message));
    },
    close(ws) {
      const state = bridgeStates.get(ws);
      if (state?.upstream && state.upstream.readyState === WebSocket.OPEN) {
        state.upstream.close();
      }
      bridgeStates.delete(ws);
    }
  }
});

console.log(`Bun video proxy server listening on http://${server.hostname}:${server.port}`);
