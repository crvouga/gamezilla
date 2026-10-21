/** Bound artifact downloads and decompression separately from task execution. */
export function verifyCacheConcurrency(
  env: NodeJS.ProcessEnv,
  fallback: number
): number {
  const value = env['VERIFY_CACHE_CONCURRENCY']?.trim();
  if (!value) return fallback;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('VERIFY_CACHE_CONCURRENCY must be a positive integer');
  return count;
}
