/** Full-jitter exponential backoff delay in ms. */
export function fullJitterDelayMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  random: () => number
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.floor(random() * exp);
}

export function randomClientIdSuffix(random: () => number): string {
  return Math.floor(random() * 1e12)
    .toString(36)
    .padStart(8, '0');
}
