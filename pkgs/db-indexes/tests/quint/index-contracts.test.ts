import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeature } from '@pkgs/gherkin/parse';
import { quintNames } from '@pkgs/quint/names';
import { modelInvariants, QUINT_CLI, simulate } from '@pkgs/quint/simulate';
import { typecheck } from '@pkgs/quint/typecheck';
import { verify } from '@pkgs/quint/verify';

// Specification validity only. No reconciler or database is exercised here.
const MODEL_TIMEOUT_MS = 120_000;
const SPEC = join(
  import.meta.dir,
  '../../../../specs/db-indexes/index-reconciliation.qnt'
);
const REPORT = join(import.meta.dir, '../../.cache/index-contracts');

describe('automatic index contract validity', () => {
  test('every example parses with one action and an outcome', () => {
    const path = join(
      import.meta.dir,
      '../../../../specs/db-indexes/automatic-indexes.feature'
    );
    const feature = parseFeature(readFileSync(path, 'utf8'), path);
    expect(feature.scenarios.length).toBeGreaterThan(0);
    for (const scenario of feature.scenarios) {
      expect(
        scenario.steps.filter((step) => step.type === 'Action')
      ).toHaveLength(1);
      expect(scenario.steps.some((step) => step.type === 'Outcome')).toBe(true);
    }
  });

  test(
    'types and concrete retirement witnesses',
    () => {
      expect(typecheck(SPEC)).toEqual({ ok: true });
      const witnesses = spawnSync(
        process.execPath,
        [
          QUINT_CLI,
          'test',
          SPEC,
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
        specPath: SPEC,
        traces: 100,
        maxSteps: 30,
        outDir: join(REPORT, 'traces'),
      });
      expect(result.invariants.length).toBeGreaterThan(0);
      expect(result.traces.length).toBeGreaterThan(0);
      const taken = new Set(
        result.traces.flatMap((trace) =>
          trace.states.map((state) => state.action)
        )
      );
      for (const action of quintNames(readFileSync(SPEC, 'utf8'))
        .declarations) {
        if (action.kind === 'action' && action.name !== 'step')
          expect(taken.has(action.name)).toBe(true);
      }
    },
    MODEL_TIMEOUT_MS
  );

  test(
    'all interleavings through ten steps preserve every declared invariant',
    async () => {
      const result = await verify({
        specPath: SPEC,
        invariants: modelInvariants(readFileSync(SPEC, 'utf8')),
        maxSteps: 10,
        outDir: join(REPORT, 'verify'),
        timeoutMs: MODEL_TIMEOUT_MS,
      });
      expect(result).toMatchObject({ ok: true });
    },
    MODEL_TIMEOUT_MS
  );
});
