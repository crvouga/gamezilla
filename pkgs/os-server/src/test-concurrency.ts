// @io-wall-ok — Bun test flag CLI; callers inject the environment into the resolver.
/** Explicit limits lower the caller's existing concurrency ceiling. */
export function testConcurrency(env: NodeJS.ProcessEnv, fallback = 20): number {
  if (!Number.isSafeInteger(fallback) || fallback < 1)
    throw new Error('Test concurrency ceiling must be a positive integer');
  const value = env['CHECK_TEST_CONCURRENCY']?.trim();
  if (!value) return fallback;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('CHECK_TEST_CONCURRENCY must be a positive integer');
  return Math.min(fallback, count);
}

if (import.meta.main)
  process.stdout.write(
    `${testConcurrency(process.env, Number(process.argv[2] ?? '20'))}\n`
  );
