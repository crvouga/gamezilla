/** OpenTofu plan exits 0 when nothing changed and 2 when it has a diff. */
export function planReadFailed(status: number): boolean {
  return status !== 0 && status !== 2;
}

const TRANSIENT_PLAN_FAILURE = [
  'Client Error',
  'connection reset',
  'connection refused',
  'i/o timeout',
  'TLS handshake timeout',
  'http2: client connection lost',
  'EOF',
] as const;

/**
 * The plan never produced a diff: the provider connection dropped while
 * reading live state. Read it again.
 */
export function planFailureIsTransient(output: string): boolean {
  return TRANSIENT_PLAN_FAILURE.some((needle) => output.includes(needle));
}
