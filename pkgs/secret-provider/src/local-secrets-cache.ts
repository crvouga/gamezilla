/**
 * Local Infisical secrets dump under `.cache/secrets/` for offline-first
 * `secrets-run` / check. Callers inject an ObjectStore rooted at the repo tree.
 */

import type { ObjectStore } from '@pkgs/object-store/interface';

export const SECRETS_CACHE_PREFIX = '.cache/secrets';
export const SECRETS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type SecretsCacheEnv = 'dev' | 'prd';

export type SecretsCacheMeta = {
  readonly pulledAt: string;
  readonly projectId: string;
  readonly envs: readonly SecretsCacheEnv[];
};

const META_KEY = `${SECRETS_CACHE_PREFIX}/meta.json`;
function envMapKey(env: SecretsCacheEnv): string {
  return `${SECRETS_CACHE_PREFIX}/${env}.json`;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function readUtf8(
  store: ObjectStore,
  key: string
): Promise<string | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  const reader = obj.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/** Parse Infisical `export --format=json` stdout into a key/value map. */
export function parseInfisicalExportJson(
  raw: string
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  const trimmed = raw.trim();
  if (trimmed.length === 0) return map;
  const parsed: unknown = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) return map;
  for (const item of parsed) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const key = rec['key'];
    const value = rec['value'];
    if (
      typeof key === 'string' &&
      key.length > 0 &&
      typeof value === 'string'
    ) {
      map.set(key, value);
    }
  }
  return map;
}

export function mapToJsonRecord(
  map: ReadonlyMap<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of [...map.entries()].toSorted(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )) {
    out[key] = value;
  }
  return out;
}

export function jsonRecordToMap(
  record: Record<string, unknown>
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') map.set(key, value);
  }
  return map;
}

export async function readSecretsCacheMap(
  store: ObjectStore,
  env: SecretsCacheEnv
): Promise<ReadonlyMap<string, string> | null> {
  const raw = await readUtf8(store, envMapKey(env));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return jsonRecordToMap(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function writeSecretsCacheMap(
  store: ObjectStore,
  env: SecretsCacheEnv,
  map: ReadonlyMap<string, string>
): Promise<void> {
  const body = `${JSON.stringify(mapToJsonRecord(map), null, 2)}\n`;
  await store.put(envMapKey(env), encodeUtf8(body), 'application/json');
}

export async function readSecretsCacheMeta(
  store: ObjectStore
): Promise<SecretsCacheMeta | null> {
  const raw = await readUtf8(store, META_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const rec = parsed as Record<string, unknown>;
    const pulledAt = rec['pulledAt'];
    const projectId = rec['projectId'];
    const envs = rec['envs'];
    if (typeof pulledAt !== 'string' || typeof projectId !== 'string') {
      return null;
    }
    if (!Array.isArray(envs)) return null;
    const cacheEnvs: SecretsCacheEnv[] = [];
    for (const e of envs) {
      if (e === 'dev' || e === 'prd') cacheEnvs.push(e);
    }
    if (cacheEnvs.length === 0) return null;
    return { pulledAt, projectId, envs: cacheEnvs };
  } catch {
    return null;
  }
}

export async function writeSecretsCacheMeta(
  store: ObjectStore,
  meta: SecretsCacheMeta
): Promise<void> {
  const body = `${JSON.stringify(meta, null, 2)}\n`;
  await store.put(META_KEY, encodeUtf8(body), 'application/json');
}

/**
 * True when `pulledAt` is missing/unparseable or older than `ttlMs`
 * relative to `nowMs` (injected clock).
 */
export function isSecretsCacheStale(
  meta: SecretsCacheMeta,
  nowMs: number,
  ttlMs: number = SECRETS_CACHE_TTL_MS
): boolean {
  const pulledMs = Date.parse(meta.pulledAt);
  if (Number.isNaN(pulledMs)) return true;
  return nowMs - pulledMs > ttlMs;
}

/** Merge cached secrets into a child env (cache keys overwrite). */
export function mergeSecretsIntoEnv(
  base: NodeJS.ProcessEnv,
  secrets: ReadonlyMap<string, string>
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...base };
  for (const [key, value] of secrets) {
    out[key] = value;
  }
  return out;
}

export function secretsCacheRelPath(env: SecretsCacheEnv): string {
  return envMapKey(env);
}

export function secretsCacheMetaRelPath(): string {
  return META_KEY;
}
