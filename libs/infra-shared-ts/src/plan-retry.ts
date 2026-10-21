/** OpenTofu plan exits 0 when nothing changed and 2 when it has a diff. */
export function planReadFailed(status: number): boolean {
  return status !== 0 && status !== 2;
}

const TRANSIENT_PROVIDER_FAILURE = [
  'Client Error',
  'connection reset',
  'connection refused',
  'i/o timeout',
  'TLS handshake timeout',
  'http2: client connection lost',
  'context deadline exceeded',
  'EOF',
] as const;

/**
 * A provider's connection dropped or its API timed out, reading live state
 * (plan) or changing it (apply). Neither says the configuration is wrong:
 * plan again, which refreshes whatever the failed call did finish.
 */
export function providerFailureIsTransient(output: string): boolean {
  return TRANSIENT_PROVIDER_FAILURE.some((needle) => output.includes(needle));
}
