import fc from 'fast-check';

let configured = false;

/**
 * Apply global fast-check defaults once per process.
 *
 * - `PBT_NUM_RUNS` overrides run count (else 10 local / 40 in CI)
 * - `FC_SEED` pins the seed (default `424242`) unless `PBT_RANDOM=1`
 * - `interruptAfterTimeLimit` keeps a hung property from blocking CI
 */
export function configurePbt(): void {
  if (configured) return;
  configured = true;

  const fromEnv = process.env['PBT_NUM_RUNS'];
  const numRuns =
    fromEnv !== undefined && fromEnv.length > 0
      ? Number(fromEnv)
      : process.env['CI'] === 'true'
        ? 40
        : 10;

  const random = process.env['PBT_RANDOM'] === '1';
  const seedRaw = process.env['FC_SEED'];
  const seed = random
    ? undefined
    : seedRaw !== undefined && seedRaw.length > 0
      ? Number(seedRaw)
      : 424_242;

  fc.configureGlobal({
    numRuns: Number.isFinite(numRuns) && numRuns > 0 ? numRuns : 10,
    ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
    verbose: 2,
    interruptAfterTimeLimit: 15_000,
    markInterruptAsFailure: true,
  });
}
