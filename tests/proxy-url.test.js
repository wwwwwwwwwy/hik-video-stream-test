import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createLocalPlaybackUrl,
  deriveUpstreamPlayback,
  normalizeUpstreamPlaybackMessage,
  rewriteClientPlaybackMessage
} from '../server/proxy-url.js';

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

  test('rewrites node ws text buffers before forwarding client play commands upstream', () => {
    const message = Buffer.from(
      JSON.stringify({
        sequence: 0,
        cmd: 'realplay',
        url: 'ws://127.0.0.1:8080/openUrl/local-id',
        playURL: 'ws://127.0.0.1:8080/openUrl/local-id'
      })
    );
    const record = {
      id: 'local-id',
      upstreamPlayURL: 'ws://192.168.64.44:559/openUrl/X1ZRp9C'
    };

    assert.equal(
      rewriteClientPlaybackMessage(record, message, false),
      JSON.stringify({
        sequence: 0,
        cmd: 'realplay',
        url: 'ws://192.168.64.44:559/openUrl/X1ZRp9C',
        playURL: 'ws://192.168.64.44:559/openUrl/X1ZRp9C'
      })
    );
  });

  test('forwards upstream node ws text buffers to the browser as strings', () => {
    const message = Buffer.from(JSON.stringify({ PKD: 'pkd', rand: 'rand' }));

    assert.equal(normalizeUpstreamPlaybackMessage(message, false), JSON.stringify({ PKD: 'pkd', rand: 'rand' }));
  });
});
