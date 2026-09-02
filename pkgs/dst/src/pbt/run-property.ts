import { configurePbt } from '@pkgs/pbt';
import type { IAsyncProperty, Parameters } from 'fast-check';
import fc from 'fast-check';

export type RunPropertyOptions = Parameters<unknown> & {
  readonly numRuns?: number;
  readonly interruptAfterTimeLimit?: number;
};

/* Reads `process.env` — the documented Runner boundary (not simulation state). */
function defaultNumRuns(): number {
  const fromEnv = process.env['PBT_SAMPLE_RUNS'];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env['CI'] === 'true' ? 12 : 6;
}

function defaultInterruptMs(): number {
  const fromEnv = process.env['PBT_SAMPLE_INTERRUPT_MS'];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env['PBT_RANDOM'] === '1' ? 120_000 : 60_000;
}

/**
 * Low-level Runner: `fc.assert` with the shared run budget. Prefer
 * {@link check} when the property is "a Scenario holds under a Workload".
 */
export async function runProperty<Ts>(
  _name: string,
  property: IAsyncProperty<Ts>,
  params?: RunPropertyOptions
): Promise<void> {
  configurePbt();
  const numRuns = params?.numRuns ?? defaultNumRuns();
  const interruptAfterTimeLimit =
    params?.interruptAfterTimeLimit ?? defaultInterruptMs();
  const { interruptAfterTimeLimit: _drop2, ...rest } = params ?? {};
  void _drop2;
  return fc.assert(property, {
    ...rest,
    numRuns,
    interruptAfterTimeLimit,
    markInterruptAsFailure: true,
    verbose: 2,
  });
}
