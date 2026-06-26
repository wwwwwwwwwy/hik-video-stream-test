import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createLocalPlaybackUrl, deriveUpstreamPlayback, extractProxyId } from '../server/proxy-url.js';

describe('proxy url helpers', () => {
  test('creates a local playback url with the proxy id as the openUrl token', () => {
    const localUrl = createLocalPlaybackUrl({
      id: 'abc123',
      host: '127.0.0.1:8080',
      secure: false
    });

    assert.equal(localUrl, 'ws://127.0.0.1:8080/openUrl/abc123');
  });

  test('derives an upstream media websocket for a direct ws openUrl', () => {
    const upstream = deriveUpstreamPlayback('ws://192.168.64.44:559/openUrl/2FSYiVa');

    assert.equal(upstream.connectUrl, 'ws://192.168.64.44:559/media?version=0.1&cipherSuites=0&sessionID=');
    assert.equal(upstream.playURL, 'ws://192.168.64.44:559/openUrl/2FSYiVa');
  });

  test('derives an upstream media websocket for a wss proxy openUrl', () => {
    const upstream = deriveUpstreamPlayback('wss://192.168.64.44:6014/proxy/192.168.64.44:559/openUrl/YguHECA');

    assert.equal(
      upstream.connectUrl,
      'wss://192.168.64.44:6014/media?version=0.1&cipherSuites=0&sessionID=&proxy=192.168.64.44:559'
    );
    assert.equal(upstream.playURL, 'ws://192.168.64.44:559/openUrl/YguHECA');
  });

  test('extracts the proxy id from a local openUrl playback url', () => {
    assert.equal(extractProxyId('ws://127.0.0.1:8080/openUrl/abc%20123?sessionID=ignored'), 'abc 123');
  });
});
