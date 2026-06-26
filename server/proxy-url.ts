export type LocalPlaybackInput = {
  id: string;
  host: string;
  secure: boolean;
};

export type UpstreamPlayback = {
  connectUrl: string;
  playURL: string;
};

export function assertStreamUrl(value: string): URL {
  let url: URL;

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

export function createLocalPlaybackUrl(input: LocalPlaybackInput): string {
  const protocol = input.secure ? 'wss' : 'ws';
  return `${protocol}://${input.host}/openUrl/${encodeURIComponent(input.id)}`;
}

export function extractProxyId(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/openUrl\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function deriveUpstreamPlayback(value: string): UpstreamPlayback {
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
