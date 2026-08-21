import type { ObjectStore } from '@pkgs/object-store/interface';

import type { RunsIndex, SuiteManifest, SuiteTestSummary } from '../types';
import {
  GENERATION_KEY,
  RUNS_INDEX_KEY,
  runManifestKey,
  testStepsKey,
} from './keys';

const TEXT_ENCODER = new TextEncoder();

export async function storeGetText(
  store: ObjectStore,
  key: string
): Promise<string | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  const bytes = await readAllBytes(obj.body);
  return new TextDecoder().decode(bytes);
}

export async function storeGetJson<T>(
  store: ObjectStore,
  key: string
): Promise<T | null> {
  const text = await storeGetText(store, key);
  if (text === null) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Truncated / mid-write files from a shared FS bucket.
    return null;
  }
}

export async function storePutText(
  store: ObjectStore,
  key: string,
  text: string,
  contentType: string
): Promise<void> {
  await store.put(key, TEXT_ENCODER.encode(text), contentType);
}

export async function storePutBytes(
  store: ObjectStore,
  key: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  await store.put(key, bytes, contentType);
}

export async function storePutJson(
  store: ObjectStore,
  key: string,
  value: unknown
): Promise<void> {
  await storePutText(
    store,
    key,
    JSON.stringify(value),
    'application/json; charset=utf-8'
  );
}

export async function readAllBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function loadRunsIndex(store: ObjectStore): Promise<RunsIndex> {
  return (await storeGetJson<RunsIndex>(store, RUNS_INDEX_KEY)) ?? { runs: [] };
}

export async function loadRunManifest(
  store: ObjectStore,
  runId: string
): Promise<SuiteManifest> {
  return (
    (await storeGetJson<SuiteManifest>(store, runManifestKey(runId))) ?? {
      tests: [],
      updatedAtMs: 0,
    }
  );
}

export async function bumpGeneration(store: ObjectStore): Promise<number> {
  const raw = await storeGetText(store, GENERATION_KEY);
  const next = (raw !== null ? Number(raw) || 0 : 0) + 1;
  await storePutText(
    store,
    GENERATION_KEY,
    String(next),
    'text/plain; charset=utf-8'
  );
  return next;
}

export async function readGeneration(store: ObjectStore): Promise<number> {
  const raw = await storeGetText(store, GENERATION_KEY);
  if (raw === null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function upsertTestSummary(
  tests: readonly SuiteTestSummary[],
  summary: SuiteTestSummary
): SuiteTestSummary[] {
  const next = tests.filter((t) => t.testId !== summary.testId);
  next.push(summary);
  next.sort((a, b) => a.testId.localeCompare(b.testId));
  return next;
}

export { testStepsKey };
