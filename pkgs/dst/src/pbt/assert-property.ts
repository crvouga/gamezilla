import { configurePbt } from '@pkgs/pbt';
import type { IAsyncProperty, Parameters } from 'fast-check';
import fc from 'fast-check';
import type { JsonValue } from '../json';

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

/** Low-level fc.assert wrapper for DST (prefer {@link assertDst}). */
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

export const arbWorldSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export function arbFromKnobDefs(
  defs: readonly {
    readonly id: string;
    readonly arb: fc.Arbitrary<JsonValue>;
  }[]
): fc.Arbitrary<Record<string, JsonValue>> {
  const shape: Record<string, fc.Arbitrary<JsonValue>> = {};
  for (const def of defs) {
    shape[def.id] = def.arb;
  }
  return fc.record(shape);
}
