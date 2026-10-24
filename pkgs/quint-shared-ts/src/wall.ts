/**
 * The wall this package reads: the seed a model's traces are drawn from, how
 * many of them a run replays, and the clock and timer that bound a model
 * check.
 *
 * The seed is the seed policy of `@pkgs/property-shared-ts`, as the hex string Quint
 * takes: `FC_SEED` (default `424242`) on every machine, so a verdict is a
 * function of the code; any seed under `PBT_RANDOM=1`
 * (`bun run test:pbt:random`), which the test names print, so a find replays
 * with `FC_SEED=<that seed>`.
 */

const DEFAULT_SEED = 424_242;

/**
 * Traces replayed when a run names no budget. The selection keeps the whole
 * cover of bound actions even past the budget, so one is the smallest set
 * that leaves no binding unexercised.
 */
export const DEFAULT_REPLAY_TRACES = 1;

export function quintSeed(): string {
  if (process.env['PBT_RANDOM'] === '1') {
    const [draw = 0] = crypto.getRandomValues(new Uint32Array(1));
    return `0x${draw.toString(16)}`;
  }
  const raw = process.env['FC_SEED'];
  const seed = raw !== undefined && raw.length > 0 ? Number(raw) : DEFAULT_SEED;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error(`quint: FC_SEED=${String(raw)} is not a whole number`);
  }
  return `0x${seed.toString(16)}`;
}

/**
 * The most drawn traces of one model this run replays through the product:
 * `QUINT_REPLAY_TRACES`. Unset or empty is {@link DEFAULT_REPLAY_TRACES}, the
 * smallest selection that still takes every bound action, so a run is
 * bounded unless it asks to explore; `all` replays every drawn trace; a whole
 * number replays that many. Like the seed it is part of what a verdict is a
 * function of, so the task that runs models declares it.
 */
export function quintReplayBudget(): number {
  const raw = process.env['QUINT_REPLAY_TRACES']?.trim() ?? '';
  if (raw.length === 0) return DEFAULT_REPLAY_TRACES;
  if (raw === 'all') return Number.POSITIVE_INFINITY;
  const budget = Number(raw);
  if (!Number.isSafeInteger(budget) || budget < 1) {
    throw new Error(
      `quint: QUINT_REPLAY_TRACES=${raw} is neither "all" nor a whole number of traces`
    );
  }
  return budget;
}

/** Explicit computation mode; the local launcher opts out of time cutoffs. */
export function verificationTimeLimitsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  const mode = env['VERIFY_TIME_LIMITS']?.trim() ?? '';
  if (mode === 'off') return false;
  if (mode === '' || mode === 'on') return true;
  throw new Error(`verification: VERIFY_TIME_LIMITS=${mode} must be on or off`);
}

/** Scale a bounded proof's allowance, or let an unlimited proof finish. */
export function verifyDeadlineMs(
  declaredMs: number,
  env: Readonly<Record<string, string | undefined>> = process.env
): number {
  if (!verificationTimeLimitsEnabled(env)) return Number.POSITIVE_INFINITY;
  const raw = env['QUINT_VERIFY_TIME_SCALE']?.trim() ?? '';
  if (raw.length === 0) return declaredMs;
  const scale = Number(raw);
  if (!Number.isFinite(scale) || scale < 1) {
    throw new Error(
      `quint: QUINT_VERIFY_TIME_SCALE=${raw} is not a factor of one or more`
    );
  }
  return Math.round(declaredMs * scale);
}

/** Milliseconds since the call, read on each call. Reported, never decided on. */
export function wallStopwatch(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/** Call `onExpire` once `ms` have passed; the returned function cancels it. */
export function wallDeadline(ms: number, onExpire: () => void): () => void {
  if (ms === Number.POSITIVE_INFINITY) return () => {};
  const timer = setTimeout(onExpire, ms);
  return () => clearTimeout(timer);
}
