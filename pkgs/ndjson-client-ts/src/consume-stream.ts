import { NdjsonStreamDecoder } from '@pkgs/ndjson-shared-ts/decode';
import type { OnNdjsonErrorFrame } from './indexed-collector';
import { IndexedNdjsonCollector } from './indexed-collector';

export type CollectIndexedNdjsonOptions = {
  /** Optional eager hook fired when an `error` frame is decoded. */
  onErrorFrame?: OnNdjsonErrorFrame;
};

/**
 * Drain a `ReadableStream<Uint8Array>` of NDJSON bytes into an ordered
 * `T[]`. Reads chunks, decodes lines, threads each frame through an
 * {@link IndexedNdjsonCollector}, and finalizes once the stream
 * completes. Throws {@link IndexedNdjsonStreamError} on the first
 * per-item failure, or a plain `Error` on protocol violations
 * (truncated stream, missing slot, frame after `end`, …).
 */
export async function collectIndexedNdjsonStream<T>(
  body: ReadableStream<Uint8Array> | null,
  expected: number,
  options?: CollectIndexedNdjsonOptions
): Promise<T[]> {
  if (body === null) {
    throw new Error(
      `ndjson: response missing body stream (expected=${expected})`
    );
  }
  const collector = new IndexedNdjsonCollector<T>(
    expected,
    options?.onErrorFrame !== undefined
      ? { onErrorFrame: options.onErrorFrame }
      : undefined
  );
  const decoder = new NdjsonStreamDecoder();
  const reader = body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    const frames = decoder.push(value ?? new Uint8Array(0), done === true);
    for (const frame of frames) collector.push(frame as never);
    if (done) break;
  }
  return collector.finalize();
}
