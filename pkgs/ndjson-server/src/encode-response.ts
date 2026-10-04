import { encodeNdjsonFrame } from '@pkgs/ndjson-shared/encode';
import type { NdjsonErrorFrame, NdjsonFrame } from '@pkgs/ndjson-shared/frames';

export type EncodeNdjsonReadableStreamOptions = {
  /**
   * Builds a tail error frame when the upstream {@link AsyncIterable}
   * itself throws (i.e. an exception escaped any per-item catch the
   * producer set up). The encoder writes the frame at index `-1`,
   * appends a final `end` frame, and closes the stream so the client
   * decoder surfaces the failure instead of silently truncating.
   *
   * Defaults to a generic 500 mapping derived from `error.message`.
   */
  mapTailError?: (error: unknown) => NdjsonErrorFrame;
};

function defaultMapTailError(error: unknown): NdjsonErrorFrame {
  const message = error instanceof Error ? error.message : String(error);
  return { frame: 'error', index: -1, status: 500, message };
}

/**
 * Wrap an `AsyncIterable<NdjsonFrame<T>>` in a `ReadableStream<Uint8Array>`
 * suitable for use as an HTTP response body. Each frame is serialized as
 * one SSE `data:` event; an uncaught error from the iterable is
 * translated to a tail-error + `end` frame pair so consumers always observe
 * the wire contract (every stream ends with one `end` frame).
 */
export function encodeNdjsonReadableStream<T>(
  frames: AsyncIterable<NdjsonFrame<T>>,
  options?: EncodeNdjsonReadableStreamOptions
): ReadableStream<Uint8Array> {
  const mapTailError = options?.mapTailError ?? defaultMapTailError;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const frame of frames) {
          controller.enqueue(encoder.encode(encodeNdjsonFrame(frame)));
        }
        controller.close();
      } catch (e: unknown) {
        const tail = mapTailError(e);
        controller.enqueue(encoder.encode(encodeNdjsonFrame(tail)));
        controller.enqueue(encoder.encode(encodeNdjsonFrame({ frame: 'end' })));
        controller.close();
      }
    },
  });
}
