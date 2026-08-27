import type { IAsyncProperty, Parameters } from 'fast-check';
import fc from 'fast-check';

import { configurePbt } from './configure';

export type AssertDstPropertyParams = Parameters<unknown> & {
  readonly numRuns?: number;
  readonly interruptAfterTimeLimit?: number;
};

function dstNumRuns(): number {
  const fromEnv = process.env['PBT_DST_RUNS'];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env['CI'] === 'true' ? 12 : 6;
}

function dstInterruptMs(): number {
  const fromEnv = process.env['PBT_DST_INTERRUPT_MS'];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env['PBT_RANDOM'] === '1' ? 120_000 : 60_000;
}

/**
 * Property assertion tuned for SimWorld DST (openSimWorld + command sequences).
 * Caps run count and extends the interrupt budget so `test:pbt:random` cannot
 * accidentally run 200 full-world properties.
 */
export async function assertDstProperty<Ts>(
  _name: string,
  property: IAsyncProperty<Ts>,
  params?: AssertDstPropertyParams
): Promise<void> {
  configurePbt();
  const numRuns = params?.numRuns ?? dstNumRuns();
  const interruptAfterTimeLimit =
    params?.interruptAfterTimeLimit ?? dstInterruptMs();
  const {
    numRuns: _drop,
    interruptAfterTimeLimit: _drop2,
    ...rest
  } = params ?? {};
  void _drop;
  void _drop2;
  return fc.assert(property, {
    ...rest,
    numRuns,
    interruptAfterTimeLimit,
    markInterruptAsFailure: true,
    verbose: 2,
  });
}
