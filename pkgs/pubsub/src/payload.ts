export const PAYLOAD_MAX_BYTES = 32 * 1024;

export function encodePayload(data: unknown): string {
  let encoded: string;
  try {
    encoded = JSON.stringify(data);
  } catch (cause) {
    throw new Error('Payload is not JSON-serializable', { cause });
  }
  if (encoded === undefined) {
    throw new Error('Payload is not JSON-serializable');
  }
  const bytes = new TextEncoder().encode(encoded).byteLength;
  if (bytes > PAYLOAD_MAX_BYTES) {
    throw new Error(
      `Payload exceeds ${String(PAYLOAD_MAX_BYTES)} bytes (got ${String(bytes)})`
    );
  }
  return encoded;
}

export function decodePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    console.warn('[pubsub] malformed payload dropped');
    return undefined;
  }
}
