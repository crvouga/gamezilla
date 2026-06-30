const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** W3C trace id — 32 lowercase hex chars. */
export function createTraceId(): string {
  return randomHex(TRACE_ID_BYTES);
}

/** W3C span id — 16 lowercase hex chars. */
export function createSpanId(): string {
  return randomHex(SPAN_ID_BYTES);
}
