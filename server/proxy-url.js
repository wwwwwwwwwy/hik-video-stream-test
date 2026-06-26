export function assertStreamUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Stream URL must be a valid ws:// or wss:// URL.');
  }

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Stream URL must use ws:// or wss://.');
  }

  return url;
}

export function createLocalPlaybackUrl(input) {
  const protocol = input.secure ? 'wss' : 'ws';
  return `${protocol}://${input.host}/openUrl/${encodeURIComponent(input.id)}`;
}

export function extractProxyId(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/openUrl\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function normalizePlaybackPayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }
  if (Buffer.isBuffer(payload)) {
    return payload;
  }
  if (Array.isArray(payload)) {
    return Buffer.concat(payload);
  }
  return Buffer.from(payload);
}

function textFromPlaybackPayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }
  return normalizePlaybackPayload(payload).toString('utf8');
}

export function rewriteClientPlaybackMessage(record, message, isBinary = false) {
  if (isBinary) {
    return normalizePlaybackPayload(message);
  }

  let text;
  try {
    text = textFromPlaybackPayload(message);
  } catch {
    return normalizePlaybackPayload(message);
  }

  try {
    const parsed = JSON.parse(text);
    for (const key of ['url', 'playURL']) {
      if (typeof parsed[key] === 'string' && extractProxyId(parsed[key]) === record.id) {
        parsed[key] = record.upstreamPlayURL;
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return typeof message === 'string' ? message : normalizePlaybackPayload(message);
  }
}

export function normalizeUpstreamPlaybackMessage(message, isBinary = false) {
  if (isBinary) {
    return normalizePlaybackPayload(message);
  }
  return textFromPlaybackPayload(message);
}

export function deriveUpstreamPlayback(value) {
  const url = assertStreamUrl(value);
  const versionQuery = 'version=0.1&cipherSuites=0&sessionID=';

  if (url.protocol === 'wss:' && url.pathname.includes('/proxy/')) {
    const proxy = url.pathname.split('/proxy/').pop()?.split('/').shift();
    if (!proxy) {
      throw new Error('Proxy stream URL is missing the proxy target segment.');
    }

    return {
      connectUrl: `${url.protocol}//${url.host}/media?${versionQuery}&proxy=${proxy}`,
      playURL: value.replace('wss:', 'ws:').replace(url.host, '').replace('/proxy/', '')
    };
  }

  return {
    connectUrl: `${url.protocol}//${url.host}/media?${versionQuery}`,
    playURL: value
  };
}
