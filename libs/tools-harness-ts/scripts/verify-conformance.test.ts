import { describe, expect, test } from 'bun:test';
import { REQUIREMENTS } from '@pkgs/conformance-shared-ts/manifest';

import { EVIDENCE_MAP, RELEASE_GATE_TASKS } from '../conformance/evidence-map';
import { verdictsFromPlan } from '../conformance/gate-verdicts';
import { reachableVerifyTasks } from '../conformance/gating-tasks';
import { LINES } from '../conformance/lines';
import type { RunPlan } from './turbo-preflight';

describe('reachableTasks', () => {
  const tasks = {
    '@libs/tools-harness-ts#ci:specs': {
      dependsOn: ['@libs/tools-harness-ts#tc'],
    },
    lint: { dependsOn: ['tc'] },
    tc: { dependsOn: ['^src'] },
    '//#deploy': { dependsOn: ['health'] },
  };
  const scripts = new Map([
    ['@apps/web', new Set(['lint', 'tc', 'verify:bundle'])],
    ['@libs/tools-harness-ts', new Set(['lint', 'tc'])],
    ['@libs/ui', new Set(['tc'])],
  ]);

  test('expands bare names to every package that has the script, and follows deps', () => {
    const reached = reachableVerifyTasks(tasks, scripts, [
      'lint',
      '@apps/web#verify:bundle',
      '@libs/tools-harness-ts#ci:specs',
    ]);
    expect([...reached].sort()).toEqual(
      [
        '@libs/tools-harness-ts#ci:specs',
        '@libs/tools-harness-ts#tc',
        'lint',
        '@apps/web#lint',
        '@libs/tools-harness-ts#lint',
        '@apps/web#tc',
        '@apps/web#verify:bundle',
        'src',
      ].sort()
    );
  });

  test('never reaches what only another root depends on', () => {
    expect(reachableVerifyTasks(tasks, scripts, ['lint']).has('health')).toBe(
      false
    );
  });
});

describe('the evidence map', () => {
  test('feeds exactly the report lines', () => {
    expect(Object.keys(EVIDENCE_MAP.lines).sort()).toEqual(
      Object.keys(LINES).sort()
    );
  });

  test('maps every known readiness requirement to report lines that exist', () => {
    for (const requirement of REQUIREMENTS) {
      const proofs = EVIDENCE_MAP['production readiness'][requirement] ?? [];
      expect({ requirement, empty: proofs.length === 0 }).toEqual({
        requirement,
        empty: false,
      });
      for (const proof of proofs) {
        expect('line' in proof && Object.hasOwn(LINES, proof.line)).toBe(true);
      }
    }
  });

  test('the release-gates line is fed by every gate verification', () => {
    expect(EVIDENCE_MAP.lines['release-gates']).toEqual(
      RELEASE_GATE_TASKS.map((task) => ({ task }))
    );
    expect(RELEASE_GATE_TASKS).toContain('tc');
  });
});

function plan(tasks: readonly (readonly [string, boolean])[]): RunPlan {
  const planned = tasks.map(([taskId, hit]) => ({
    taskId,
    hash: taskId,
    hit,
    source: hit ? ('LOCAL' as const) : null,
    dependencies: [],
  }));
  return {
    tasks: planned,
    toExecute: planned.filter((t) => !t.hit),
    remoteHits: [],
  };
}

describe('verdictsFromPlan', () => {
  const run = plan([
    ['@libs/tools-harness-ts#ci:audit', true],
    ['@apps/web#tc', true],
    ['@libs/ui#tc', false],
    ['@apps/web#lint', true],
  ]);

  test('a gate passes only when every task it names is a cache hit', () => {
    const verdicts = verdictsFromPlan(run, [
      '@libs/tools-harness-ts#ci:audit',
      'tc',
      'lint',
      '@libs/infra-server-ts#lint',
    ]);
    expect(verdicts.get('@libs/tools-harness-ts#ci:audit')?.status).toBe(
      'pass'
    );
    expect(verdicts.get('lint')).toEqual({
      status: 'pass',
      detail: 'passed for these inputs (1 task)',
    });
    expect(verdicts.get('tc')).toEqual({
      status: 'fail',
      detail:
        'not run for these inputs — 1 of 2 not passed in the build cache (@libs/ui#tc)',
    });
    expect(verdicts.get('@libs/infra-server-ts#lint')).toEqual({
      status: 'fail',
      detail: 'not run — bun verify does not plan it',
    });
  });
});
