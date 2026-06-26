import { randomUUID } from 'node:crypto';
import { createLocalPlaybackUrl, deriveUpstreamPlayback } from './proxy-url.js';

const records = new Map();
const ttlMs = 10 * 60 * 1000;

export function createProxyRecord(sourceUrl, host, secure) {
  const id = randomUUID();
  const upstream = deriveUpstreamPlayback(sourceUrl);
  const now = Date.now();
  const record = {
    id,
    sourceUrl,
    localUrl: createLocalPlaybackUrl({ id, host, secure }),
    upstreamConnectUrl: upstream.connectUrl,
    upstreamPlayURL: upstream.playURL,
    createdAt: now,
    expiresAt: now + ttlMs
  };

  records.set(id, record);
  return record;
}

export function getProxyRecord(id) {
  const record = records.get(id);
  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    records.delete(id);
    return null;
  }

  return record;
}

export function pruneProxyRecords() {
  const now = Date.now();
  for (const [id, record] of records) {
    if (record.expiresAt <= now) {
      records.delete(id);
    }
  }
}
