// @io-wall-ok — the check it registers runs the Quint CLI.
/**
 * The model-wide check of a model run, before any trace reaches the product:
 * the model type checks. Apalache's exhaustive check (`./verify`) depends on
 * the model's text alone, so it runs in the package's models check
 * (`check:models`), cached on the model's text, not in the spec suite.
 */

import { test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { decide, type RecordObligation } from './model-evidence';
import { formatModelShapeIssue, modelShapeIssues } from './shape';
import { typecheck } from './typecheck';

/** Spawns the Quint CLI: ~0.5 s idle, a few seconds under a loaded gate. */
const TYPECHECK_TIMEOUT_MS = 30_000;

export type ModelChecksInput = {
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  readonly record: RecordObligation;
};

export function registerModelChecks(input: ModelChecksInput): void {
  const { specPath, record } = input;
  test('has a valid aggregate shape', () =>
    decide({
      record,
      id: 'shape',
      layer: 'specification',
      body: () => {
        const found = modelShapeIssues(
          readFileSync(specPath, 'utf8'),
          specPath
        );
        if (found.length > 0) {
          throw new Error(
            found
              .map((item) => formatModelShapeIssue(specPath, item))
              .join('\n')
          );
        }
        return undefined;
      },
    }));
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
}
