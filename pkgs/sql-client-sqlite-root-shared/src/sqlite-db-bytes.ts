/** SQLite on-disk / serialize() magic (16 bytes including NUL). */
const SQLITE_HEADER = 'SQLite format 3\0';

function flattenErrorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current !== null && current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(`${current.name} ${current.message}`);
      current = 'cause' in current ? current.cause : undefined;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(' → ');
}

export function isNotADatabaseError(error: unknown): boolean {
  const msg = flattenErrorText(error);
  return (
    /file is not a database/i.test(msg) ||
    /SQLITE_NOTADB/i.test(msg) ||
    /error code 26/i.test(msg)
  );
}

/**
 * Normalize RPC / S3 / TypedArray views into a tightly packed Uint8Array and
 * reject anything that is not a SQLite database image.
 */
export function coerceSqliteDbBytes(input: unknown): Uint8Array {
  let view: Uint8Array;
  if (input instanceof Uint8Array) {
    view = input;
  } else if (input instanceof ArrayBuffer) {
    view = new Uint8Array(input);
  } else if (ArrayBuffer.isView(input)) {
    const v = input as ArrayBufferView;
    view = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  } else {
    throw new Error(
      `sqlite blob: expected Uint8Array/ArrayBuffer, got ${Object.prototype.toString.call(input)}`
    );
  }
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(view);
  assertSqliteDbHeader(bytes);
  return bytes;
}

export function assertSqliteDbHeader(bytes: Uint8Array): void {
  if (bytes.byteLength < 100) {
    throw new Error(`sqlite blob too short (${bytes.byteLength} bytes)`);
  }
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== SQLITE_HEADER.charCodeAt(i)) {
      const got = String.fromCharCode(
        ...bytes.subarray(0, Math.min(16, bytes.byteLength))
      );
      throw new Error(
        `sqlite blob missing header (got ${JSON.stringify(got)})`
      );
    }
  }
}
