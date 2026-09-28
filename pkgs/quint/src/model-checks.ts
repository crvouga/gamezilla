// @io-wall-ok — reads the model's text for its invariants; the checks it registers run Quint and Apalache.
/**
 * The model-wide checks of a model run, before any trace reaches the
 * product: the model type checks, and Apalache model-checks every
 * `val inv<Name>` over every behavior up to the binding's `verifySteps`. A
 * model with no invariant fails: a model checked against nothing proves
 * nothing.
 */

import { test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { decide, type RecordObligation } from './model-evidence';
import { DEFAULT_VERIFY_STEPS, type QuintBinding } from './registry';
import { modelInvariants } from './simulate';
import { typecheck } from './typecheck';
import { verify } from './verify';

/** The least a model check may take before it is killed. */
export const VERIFY_TIMEOUT_MS = 240_000;
/** Room for the check's own deadline to fire, and clean up, before the test's. */
const TEST_GRACE_MS = 30_000;
/** Spawns the Quint CLI: ~0.5 s idle, a few seconds under a loaded gate. */
const TYPECHECK_TIMEOUT_MS = 30_000;

export type ModelChecksInput = {
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** Its binding, when it has one (for `verifySteps` and `timeoutMs`). */
  readonly binding: QuintBinding<unknown> | null;
  /** Where Apalache works (`<reportDir>/quint/<model>.verify`). */
  readonly outDir: string;
  readonly record: RecordObligation;
};

export function registerModelChecks(input: ModelChecksInput): void {
  const { specPath, binding, record } = input;
  test(
    'type checks',
    () =>
      decide({
        record,
        id: 'typecheck',
        layer: 'specification',
        body: () => {
          const result = typecheck(specPath);
          if (!result.ok) throw new Error(result.output);
          return undefined;
        },
      }),
    TYPECHECK_TIMEOUT_MS
  );

  const steps = binding?.verifySteps ?? DEFAULT_VERIFY_STEPS;
  const timeoutMs = Math.max(VERIFY_TIMEOUT_MS, binding?.timeoutMs ?? 0);
  const invariants = modelInvariants(readFileSync(specPath, 'utf8'));
  test(
    `model checks every invariant for ${String(steps)} steps`,
    () =>
      decide({
        record,
        id: 'verify',
        layer: 'specification',
        body: async () => {
          const result = await verify({
            specPath,
            invariants,
            maxSteps: steps,
            outDir: input.outDir,
            timeoutMs,
          });
          if (!result.ok) throw new Error(result.output);
          return `${invariants.join(', ')} hold in every state within ${String(steps)} steps`;
        },
      }),
    timeoutMs + TEST_GRACE_MS
  );
}
