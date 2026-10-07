import { describe, expect, test } from 'bun:test';
import type { Result } from './check-shard-results';
import {
  formatJunit,
  formatMarkdown,
  formatTable,
  suiteOf,
  summarize,
} from './check-verdict';

function result(taskId: string, passed: boolean): Result {
  return {
    taskId,
    hash: 'h',
    passed,
    cache: 'MISS',
    milliseconds: 1,
    exitCode: passed ? 0 : 1,
  };
}

const JOBS = [
  { name: 'check:plan', result: 'success' },
  { name: 'check:shards', result: 'success' },
  { name: 'check:consumers', result: 'success' },
];

describe('check verdict', () => {
  test('groups task identities into suites', () => {
    expect(suiteOf('@apps/product#tc')).toBe('Typecheck');
    expect(suiteOf('//#lint:root')).toBe('Lint and boundaries');
    expect(suiteOf('@apps/product#test:spec:12')).toBe('Gherkin specs');
    expect(suiteOf('@apps/product#check:models')).toBe('Quint models');
    expect(suiteOf('@libs/tools#check:secrets')).toBe('Security');
    expect(suiteOf('//#ci:audit')).toBe('Security');
    expect(suiteOf('@libs/runtime-server#check:schema-evolution')).toBe(
      'Database schema'
    );
    expect(suiteOf('//#ci:syncpack')).toBe('Repository gates');
  });

  test('reports every failure across shards, not only the first', () => {
    const verdict = summarize({
      planned: ['@a/x#tc', '@a/x#test', '@a/y#test:spec:0', '@a/y#test:spec:1'],
      shards: [
        { index: 1, verdict: 1, tasks: [result('@a/y#test:spec:0', false)] },
        {
          index: 0,
          verdict: 1,
          tasks: [result('@a/x#tc', true), result('@a/x#test', false)],
        },
      ],
      jobs: JOBS,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.failures).toBe(3);
    const gherkin = verdict.suites.find((s) => s.name === 'Gherkin specs')!;
    expect(gherkin.failed.map((task) => [task.taskId, task.reason])).toEqual([
      ['@a/y#test:spec:0', 'failed'],
      ['@a/y#test:spec:1', 'missing'],
    ]);
    const table = formatTable(verdict);
    expect(table).toContain('Typecheck');
    expect(table).toMatch(/Unit tests\s+FAIL {3}1/);
    expect(table).toContain('3 total failures across 2 suites');
  });

  test('a green run with a failed upstream job is still red', () => {
    const verdict = summarize({
      planned: ['@a/x#tc'],
      shards: [{ index: 0, verdict: 0, tasks: [result('@a/x#tc', true)] }],
      jobs: [...JOBS.slice(1), { name: 'check:plan', result: 'failure' }],
    });
    expect(verdict.passed).toBe(false);
    expect(formatTable(verdict)).toContain('job check:plan');
  });

  test('a run with no evidence never passes', () => {
    const verdict = summarize({
      planned: [],
      shards: [],
      jobs: [{ name: 'check:plan', result: 'failure' }],
    });
    expect(verdict.passed).toBe(false);
    expect(formatTable(verdict)).toMatch(/job check:plan\s+FAILURE/);
    expect(formatTable(verdict)).toContain(
      'No task verdicts: 1 jobs did not succeed'
    );
  });

  test('markdown and JUnit name the failing task and its evidence', () => {
    const verdict = summarize({
      planned: ['@a/x#test'],
      shards: [{ index: 4, verdict: 1, tasks: [result('@a/x#test', false)] }],
      jobs: JOBS,
    });
    const markdown = formatMarkdown(verdict, 'https://example.test/run');
    expect(markdown).toContain('| Unit tests | FAIL | 1 | 1 |');
    expect(markdown).toContain('`check-evidence-4`');
    const junit = formatJunit(verdict);
    expect(junit).toContain(
      '<testsuite name="Unit tests" tests="1" failures="1">'
    );
    expect(junit).toContain('name="@a/x#test"');
  });
});
