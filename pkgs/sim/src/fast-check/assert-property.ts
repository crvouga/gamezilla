import type { IAsyncProperty, IProperty, Parameters } from 'fast-check';
import fc from 'fast-check';

export type AssertPropertyParams = Parameters<unknown>;

let configured = false;

/**
 * Apply global fast-check defaults once per process.
 *
 * - `PBT_NUM_RUNS` overrides run count (default 40, everywhere)
 * - `FC_SEED` pins the seed (default `424242`) unless `PBT_RANDOM=1`
 *
 * No wall-clock limit: with the seed and run count pinned, a property's
 * verdict is a function of the code alone, which is what lets turbo cache it.
 * `interruptAfterTimeLimit` made a loaded machine fail a property an idle one
 * passed. A hung property is still bounded — by the test's own timeout and the
 * gate's per-task budget.
 */
function configureFastCheck(): void {
  if (configured) return;
  configured = true;

  // One run count everywhere. CI used to explore 40 cases and a laptop 10, off
  // the same seed, so CI silently searched 30 cases nobody had run locally —
  // a property could pass on the machine that wrote it and fail on the one
  // that gates it. Tune it deliberately with `PBT_NUM_RUNS`, not by moving
  // between machines.
  const fromEnv = process.env['PBT_NUM_RUNS'];
  const numRuns =
    fromEnv !== undefined && fromEnv.length > 0 ? Number(fromEnv) : 40;

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
  });
}

/**
 * Stateless property assertion for bun:test — the pure-function counterpart
 * of `system.explore`. Applies the repo seed policy, then delegates to
 * `fc.assert` (fast-check shrinks values; `explore` shrinks action walks).
 *
 * Sync properties return `void`; async properties return `Promise<void>`
 * (call sites must `await`).
 */
export function assertProperty<Ts>(
  _name: string,
  property: IProperty<Ts>,
  params?: AssertPropertyParams
): void;
export function assertProperty<Ts>(
  _name: string,
  property: IAsyncProperty<Ts>,
  params?: AssertPropertyParams
): Promise<void>;
export function assertProperty<Ts>(
  _name: string,
  property: IProperty<Ts> | IAsyncProperty<Ts>,
  params?: AssertPropertyParams
): void | Promise<void> {
  configureFastCheck();
  return fc.assert(property, params);
}
