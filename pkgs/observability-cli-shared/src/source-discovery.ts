import type { ObjectStore } from '@pkgs/object-store-shared/interface';

export type LocalTraceSource =
  | { readonly kind: 'ndjson'; readonly path: string }
  | { readonly kind: 'tempo'; readonly url: string };

type ManifestCandidate = {
  readonly instanceId: string;
  readonly startedAtMs: number;
  readonly source: LocalTraceSource;
};

async function text(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return result + decoder.decode();
    result += decoder.decode(chunk.value, { stream: true });
  }
}

function tempoSource(value: unknown): LocalTraceSource | null {
  if (typeof value !== 'string') return null;
  const url = new URL(value);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== ''
  )
    return null;
  return { kind: 'tempo', url: url.toString().replace(/\/$/, '') };
}

function candidate(value: unknown): ManifestCandidate | null {
  if (value === null || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item['instanceId'] !== 'string' ||
    typeof item['startedAtMs'] !== 'number'
  )
    return null;
  const traceDir = item['observabilityTraceDir'];
  const source =
    typeof traceDir === 'string' &&
    traceDir.length > 0 &&
    !traceDir.includes('\0')
      ? ({ kind: 'ndjson', path: traceDir } as const)
      : tempoSource(item['observabilityTempoUrl']);
  if (source === null) return null;
  return {
    instanceId: item['instanceId'],
    startedAtMs: item['startedAtMs'],
    source,
  };
}

/** Picks the newest valid running-stack trace source, with a stable id tie-break. */
export async function discoverLatestLocalTraceSource(
  manifests: ObjectStore
): Promise<LocalTraceSource | null> {
  const found: ManifestCandidate[] = [];
  for (const key of await manifests.listKeys()) {
    if (!key.endsWith('.json')) continue;
    const object = await manifests.get(key);
    if (object === null) continue;
    try {
      const parsed = candidate(JSON.parse(await text(object.body)));
      if (parsed !== null) found.push(parsed);
    } catch {
      // A partially-written or stale manifest is not a usable source.
    }
  }
  found.sort(
    (a, b) =>
      b.startedAtMs - a.startedAtMs ||
      (a.instanceId < b.instanceId ? -1 : Number(a.instanceId > b.instanceId))
  );
  return found[0]?.source ?? null;
}
