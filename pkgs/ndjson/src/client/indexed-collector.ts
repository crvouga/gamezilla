import type { NdjsonErrorFrame, NdjsonFrame } from '../shared/frames';
import { IndexedNdjsonStreamError } from './stream-error';

/**
 * Optional hook fired the moment an `error` frame is observed. The
 * collector still records the first error and surfaces it on
 * {@link IndexedNdjsonCollector.finalize}, but transports that need to
 * react eagerly (e.g. re-raising a structured server crash through a
 * registered handler chain) can do so here without waiting for the
 * rest of the stream.
 */
export type OnNdjsonErrorFrame = (frame: NdjsonErrorFrame) => void;

type IndexedError = {
  readonly status: number;
  readonly message: string;
  readonly index: number;
  readonly kind: string | undefined;
  readonly context: Record<string, unknown> | undefined;
};

/**
 * Stateful consumer for an indexed NDJSON stream.
 *
 * Frames may arrive in any order; the collector slots each `result` into
 * its declared `index` and surfaces the *first* `error` frame as the
 * stream's failure. {@link finalize} enforces the wire contract: every
 * slot must be filled, and the producer must terminate with one `end`
 * frame. Protocol violations (frame after end, out-of-range index,
 * missing slot, missing end) throw plain `Error`s so consumers can
 * surface them however they want without forcing a crash-handler
 * dispatch.
 */
export class IndexedNdjsonCollector<T> {
  private readonly results: (T | undefined)[];
  private firstError: IndexedError | null = null;
  private sawEnd = false;
  private readonly onErrorFrame: OnNdjsonErrorFrame | undefined;

  constructor(
    private readonly expected: number,
    options?: { onErrorFrame?: OnNdjsonErrorFrame }
  ) {
    if (!Number.isInteger(expected) || expected < 0) {
      throw new Error(
        `IndexedNdjsonCollector: expected must be a non-negative integer (got ${String(expected)})`
      );
    }
    this.results = new Array<T | undefined>(expected).fill(undefined);
    this.onErrorFrame = options?.onErrorFrame;
  }

  push(frame: NdjsonFrame<T>): void {
    if (this.sawEnd) {
      throw new Error(
        `ndjson: frame received after end marker (frameKind=${frame.frame})`
      );
    }
    if (frame.frame === 'end') {
      this.sawEnd = true;
      return;
    }
    if (frame.frame === 'error') {
      this.recordError(frame);
      return;
    }
    if (frame.index < 0 || frame.index >= this.expected) {
      throw new Error(
        `ndjson: result frame index out of range (index=${frame.index}, expected=${this.expected})`
      );
    }
    this.results[frame.index] = frame.result;
  }

  private recordError(frame: NdjsonErrorFrame): void {
    if (this.onErrorFrame !== undefined) this.onErrorFrame(frame);
    if (this.firstError !== null) return;
    this.firstError = {
      status: frame.status,
      message: frame.message,
      index: frame.index,
      kind: frame.kind,
      context: frame.context,
    };
  }

  /**
   * Resolve the stream into an ordered `T[]` or throw the first error
   * surfaced during decoding. Throws when the producer truncates without
   * an `end` frame or omits a result for any expected slot.
   */
  finalize(): T[] {
    if (this.firstError !== null) {
      const e = this.firstError;
      throw new IndexedNdjsonStreamError({
        status: e.status,
        index: e.index,
        message: e.message,
        ...(e.kind !== undefined ? { kind: e.kind } : {}),
        ...(e.context !== undefined ? { context: e.context } : {}),
      });
    }
    if (!this.sawEnd) {
      throw new Error(
        `ndjson: stream ended without \`end\` frame (truncated transport, expected=${this.expected})`
      );
    }
    const out: T[] = new Array<T>(this.expected);
    for (let i = 0; i < this.expected; i++) {
      const r = this.results[i];
      if (r === undefined) {
        throw new Error(
          `ndjson: producer omitted a result frame (index=${i}, expected=${this.expected})`
        );
      }
      out[i] = r;
    }
    return out;
  }
}
