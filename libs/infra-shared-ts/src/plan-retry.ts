/** OpenTofu plan exits 0 when nothing changed and 2 when it has a diff. */
export function planReadFailed(status: number): boolean {
  return status !== 0 && status !== 2;
}

const TRANSIENT_PROVIDER_FAILURE = [
  '429 Too Many Requests',
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

/** Respect Railway's rate-limit reset instead of spending retries immediately. */
export function providerRetryWaitMs(output: string): number {
  let waitMs = 1_000;
  if (!output.includes('429 Too Many Requests')) return waitMs;
  for (const match of output.matchAll(
    /try again in (\d+(?:\.\d+)?) seconds/gi
  )) {
    const duration = Math.ceil(Number(match[1]) * 1_000);
    if (!Number.isSafeInteger(duration))
      throw new Error('Provider returned an invalid rate-limit reset duration');
    waitMs = Math.max(waitMs, duration);
  }
  return waitMs;
}

const TRANSIENT_INSTALL_FAILURE = [
  '502 Bad Gateway',
  '503 Service Unavailable',
  '504 Gateway Timeout',
  'could not connect to registry',
] as const;

/**
 * `tofu init` could not download a provider because the registry or GitHub
 * release host was briefly down. The lock file is unchanged, so init again.
 */
export function providerInstallIsTransient(output: string): boolean {
  return (
    TRANSIENT_INSTALL_FAILURE.some((needle) => output.includes(needle)) ||
    providerFailureIsTransient(output)
  );
}
