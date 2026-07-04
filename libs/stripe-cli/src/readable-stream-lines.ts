/**
 * Bun `Subprocess.stdout` / `stderr` may be typed as `ReadableStream | number`.
 * Normalize to a byte stream or `undefined`.
 */
export function asReadableUint8Stream(
  stream: ReadableStream<Uint8Array> | number | undefined
): ReadableStream<Uint8Array> | undefined {
  if (stream === undefined || typeof stream === 'number') return undefined;
  return stream;
}

function readAbortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Aborted', 'AbortError');
}

/** Read `stream` line-by-line (LF split, strip CR) until EOF or `signal` aborts. */
export async function readLinesFromStream(
  stream: ReadableStream<Uint8Array> | undefined,
  onLine: (line: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (stream === undefined) return;
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      if (signal?.aborted === true) throw readAbortError(signal);
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const p of parts) {
        onLine(p.replace(/\r$/, ''));
      }
    }
    if (buf.length > 0) onLine(buf.replace(/\r$/, ''));
  } finally {
    try {
      await reader.cancel();
    } catch {
      // stream may already be closed
    }
    reader.releaseLock();
  }
}
