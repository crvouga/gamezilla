import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeature } from '@pkgs/gherkin/parse';
import { quintNames } from '@pkgs/quint/names';
import { modelInvariants, QUINT_CLI, simulate } from '@pkgs/quint/simulate';
import { typecheck } from '@pkgs/quint/typecheck';
import { verify } from '@pkgs/quint/verify';

// Specification validity only. These checks never stand in for adapter conformance.
const MODEL_TIMEOUT_MS = 120_000;
const MODELS = ['reconciliation-transaction', 'rebuild-recovery'];
const FEATURES = ['server-reconciliation', 'client-recovery', 'schema-indexes'];

describe('reconciliation contract syntax', () => {
  for (const name of FEATURES) {
    test(name, () => {
      const path = join(
        import.meta.dir,
        '../../../../specs/db-schema',
        `${name}.feature`
      );
      const feature = parseFeature(readFileSync(path, 'utf8'), path);
      expect(feature.scenarios.length).toBeGreaterThan(0);
      for (const scenario of feature.scenarios) {
        expect(
          scenario.steps.filter((step) => step.type === 'Action')
        ).toHaveLength(1);
        expect(scenario.steps.some((step) => step.type === 'Outcome')).toBe(
          true
        );
      }
    });
  }
});

for (const name of MODELS) {
  const specPath = join(
    import.meta.dir,
    '../../../../specs/db-schema',
    `${name}.qnt`
  );
  const reportDir = join(
    import.meta.dir,
    '../../.cache/reconciliation-contracts',
    name
  );
  describe(`${name}: reference protocol validity`, () => {
    test(
      'types and concrete recovery witnesses',
      () => {
        expect(typecheck(specPath)).toEqual({ ok: true });
        const witnesses = spawnSync(
          process.execPath,
          [
            QUINT_CLI,
            'test',
            specPath,
            '--backend',
            'typescript',
            '--seed',
            '424242',
          ],
          { encoding: 'utf8' }
        );
        expect({
          code: witnesses.status,
          output: witnesses.stdout + witnesses.stderr,
        }).toMatchObject({ code: 0 });
        expect(witnesses.stdout).toMatch(/\b[1-9]\d* passing\b/);
      },
      MODEL_TIMEOUT_MS
    );

    test(
      'sampled sequences preserve every declared invariant',
      () => {
        const result = simulate({
          specPath,
          traces: 100,
          maxSteps: 30,
          outDir: join(reportDir, 'traces'),
        });
        expect(result.invariants.length).toBeGreaterThan(0);
        expect(result.traces.length).toBeGreaterThan(0);
        const taken = new Set(
          result.traces.flatMap((trace) =>
            trace.states.map((state) => state.action)
          )
        );
        for (const action of quintNames(readFileSync(specPath, 'utf8'))
          .declarations) {
          if (action.kind === 'action' && action.name !== 'step')
            expect(taken.has(action.name)).toBe(true);
        }
      },
      MODEL_TIMEOUT_MS
    );

    // regression: rebuild-model-verification-timeout
    test(
      'all interleavings through ten steps preserve every declared invariant',
      async () => {
        const result = await verify({
          specPath,
          invariants: modelInvariants(readFileSync(specPath, 'utf8')),
          maxSteps: 10,
          outDir: join(reportDir, 'verify'),
          timeoutMs: MODEL_TIMEOUT_MS,
        });
        expect(result).toMatchObject({ ok: true });
      },
      MODEL_TIMEOUT_MS
    );
  });
}
