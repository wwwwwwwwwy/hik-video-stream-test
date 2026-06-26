import { createLocalPlaybackUrl, deriveUpstreamPlayback } from './proxy-url';

export type ProxyRecord = {
  id: string;
  sourceUrl: string;
  localUrl: string;
  upstreamConnectUrl: string;
  upstreamPlayURL: string;
  createdAt: number;
  expiresAt: number;
};

const records = new Map<string, ProxyRecord>();
const ttlMs = 10 * 60 * 1000;

export function createProxyRecord(sourceUrl: string, host: string, secure: boolean): ProxyRecord {
  const id = crypto.randomUUID();
  const upstream = deriveUpstreamPlayback(sourceUrl);
  const now = Date.now();
  const record: ProxyRecord = {
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

export function getProxyRecord(id: string): ProxyRecord | null {
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

export function pruneProxyRecords(): void {
  const now = Date.now();
  for (const [id, record] of records) {
    if (record.expiresAt <= now) {
      records.delete(id);
    }
  }
}
