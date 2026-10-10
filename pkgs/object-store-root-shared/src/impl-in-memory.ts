import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore, StoredObject } from './interface';

type Entry = {
  readonly bytes: Uint8Array;
  readonly contentType: string;
};

export type ObjectStoreImplInMemoryOptions = {
  /**
   * DST fault knob: when set, the next mutating/read op throws this error
   * (then clears). Missing-key semantics stay null/false/no-op when no fault.
   */
  readonly onFault?: () => Error | null | undefined;
};

/**
 * In-process {@link ObjectStore} backed by a `Map`. Used by the conformance
 * suite in `interface.test.ts` and by sub unit tests that want to exercise
 * cache-then-generate flows without S3 / network.
 *
 * `put` defensively copies the input bytes so callers can reuse their buffer;
 * `get` returns a fresh `ReadableStream` per call so multiple readers don't
 * race over a single-use stream.
 */
export class ObjectStoreImplInMemory implements ObjectStore {
  private readonly store = new Map<string, Entry>();
  private fault: (() => Error | null | undefined) | null;
  private armedFault: Error | null = null;

  constructor(options?: ObjectStoreImplInMemoryOptions) {
    this.fault = options?.onFault ?? null;
  }

  /** Arm a one-shot transport fault for the next operation (DST). */
  armFault(error: Error): void {
    this.armedFault = error;
  }

  private maybeThrow(): void {
    if (this.armedFault !== null) {
      const err = this.armedFault;
      this.armedFault = null;
      throw err;
    }
    if (this.fault !== null) {
      const err = this.fault();
      if (err != null) throw err;
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    this.maybeThrow();
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    const bytesCopy = new Uint8Array(entry.bytes);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytesCopy);
        controller.close();
      },
    });
    return {
      body: stream,
      contentType: entry.contentType,
      size: entry.bytes.byteLength,
    };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    this.maybeThrow();
    this.store.set(key, { bytes: new Uint8Array(bytes), contentType });
  }

  async head(key: string): Promise<boolean> {
    this.maybeThrow();
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    this.maybeThrow();
    this.store.delete(key);
  }

  /**
   * Materialises a `blob:` URL for the entry when the runtime supports
   * `URL.createObjectURL` (browsers, Bun, JSDOM); returns `null` everywhere
   * else (Workers, plain Node) and for missing keys. Callers that need a
   * playable URL on those runtimes should fall back to {@link get} + manual
   * conversion.
   */
  async deleteMany(keys: readonly string[]): Promise<void> {
    for (const key of keys) await this.delete(key);
  }

  async getUri(key: string): Promise<string | null> {
    this.maybeThrow();
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function')
      return null;
    if (typeof Blob === 'undefined') return null;
    const ab = new ArrayBuffer(entry.bytes.byteLength);
    new Uint8Array(ab).set(entry.bytes);
    const blob = new Blob([ab], { type: entry.contentType });
    return URL.createObjectURL(blob);
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    this.maybeThrow();
    const keys = [...this.store.keys()].filter(
      (k) => prefix.length === 0 || k.startsWith(prefix)
    );
    return keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}
