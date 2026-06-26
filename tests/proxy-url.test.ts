import { describe, expect, test } from 'bun:test';
import { createLocalPlaybackUrl, deriveUpstreamPlayback } from '../server/proxy-url';

describe('proxy url helpers', () => {
  test('creates a local playback url with the proxy id as the openUrl token', () => {
    const localUrl = createLocalPlaybackUrl({
      id: 'abc123',
      host: '127.0.0.1:8080',
      secure: false
    });

    expect(localUrl).toBe('ws://127.0.0.1:8080/openUrl/abc123');
  });

  test('derives an upstream media websocket for a direct ws openUrl', () => {
    const upstream = deriveUpstreamPlayback('ws://192.168.64.44:559/openUrl/2FSYiVa');

    expect(upstream.connectUrl).toBe('ws://192.168.64.44:559/media?version=0.1&cipherSuites=0&sessionID=');
    expect(upstream.playURL).toBe('ws://192.168.64.44:559/openUrl/2FSYiVa');
  });

  test('derives an upstream media websocket for a wss proxy openUrl', () => {
    const upstream = deriveUpstreamPlayback('wss://192.168.64.44:6014/proxy/192.168.64.44:559/openUrl/YguHECA');

    expect(upstream.connectUrl).toBe(
      'wss://192.168.64.44:6014/media?version=0.1&cipherSuites=0&sessionID=&proxy=192.168.64.44:559'
    );
    expect(upstream.playURL).toBe('ws://192.168.64.44:559/openUrl/YguHECA');
  });
});
