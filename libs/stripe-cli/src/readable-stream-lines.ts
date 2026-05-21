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

/** Read `stream` line-by-line (LF split, strip CR) until EOF. */
export async function readLinesFromStream(
  stream: ReadableStream<Uint8Array> | undefined,
  onLine: (line: string) => void
): Promise<void> {
  if (stream === undefined) return;
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
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
    reader.releaseLock();
  }
}
