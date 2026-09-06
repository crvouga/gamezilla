/**
 * Clipboard write port. UI code receives a {@link ClipboardPort} by injection
 * (never a bare `navigator.clipboard`); the browser adapter lives in
 * {@link ./wall-web-device.ts}, sims / tests use {@link createRecordingClipboard}.
 */

export type ClipboardPort = {
  /** Writes `text` to the system clipboard. Rejects when the host denies. */
  readonly writeText: (text: string) => Promise<void>;
};

export type RecordingClipboard = ClipboardPort & {
  /** Every value written, in order. */
  readonly writes: readonly string[];
  /** Latest value written, or `null` before the first write. */
  readonly last: () => string | null;
};

/** In-memory clipboard for sims and tests. */
export function createRecordingClipboard(): RecordingClipboard {
  const writes: string[] = [];
  return {
    writes,
    last: () => writes.at(-1) ?? null,
    writeText: (text) => {
      writes.push(text);
      return Promise.resolve();
    },
  };
}
