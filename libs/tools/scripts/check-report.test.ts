import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFragment } from './check-report/collect';
import {
  type CheckFragment,
  gateFingerprint,
  mergeFragments,
  type ReportTask,
  verdictOf,
} from './check-report/model';
import { renderCheckReport } from './check-report/render';
import { readNewRunSummary, runSummaryNames } from './check-report/summaries';
import { reportFragmentPath, requestsCheck } from './turbo-ci-run';

function task(
  taskId: string,
  status: ReportTask['status'],
  hash = `h-${taskId}`
): ReportTask {
  return { taskId, hash, status, seconds: null, log: null };
}

function fragment(
  tasks: readonly ReportTask[],
  exitCode: number | null = 0
): CheckFragment {
  return {
    source: 'run',
    scm: null,
    tasks,
    exitCode,
    specRuns: [],
  };
}

describe('gate fingerprint', () => {
  test('is the same for the same task hashes in any order', () => {
    const a = [task('a#lint', 'cached'), task('b#tc', 'passed')];
    expect(gateFingerprint(a)).toBe(gateFingerprint([...a].reverse()));
    expect(gateFingerprint(a)).toMatch(/^[0-9a-f]{16}$/);
  });

  test('changes when any task hash changes', () => {
    const a = [task('a#lint', 'cached', 'x')];
    const b = [task('a#lint', 'cached', 'y')];
    expect(gateFingerprint(a)).not.toBe(gateFingerprint(b));
  });

  test('ignores outcomes: a rerun of the same inputs names the same report', () => {
    const failed = [task('a#test', 'failed')];
    const passed = [task('a#test', 'passed')];
    expect(gateFingerprint(failed)).toBe(gateFingerprint(passed));
  });
});

describe('merging fragments', () => {
  test('a shard outcome overrides the plan status of the same task', () => {
    const plan: CheckFragment = {
      ...fragment([task('a#test', 'not-run'), task('b#tc', 'cached')], null),
      source: 'plan',
    };
    const shard = fragment([task('a#test', 'passed')]);
    const report = mergeFragments([plan, shard]);
    expect(report.tasks.map((t) => [t.taskId, t.status])).toEqual([
      ['a#test', 'passed'],
      ['b#tc', 'cached'],
    ]);
    expect(report.verdict).toBe('passed');
  });

  test('a failure wins over any other fragment and sorts first', () => {
    const report = mergeFragments([
      fragment([task('a#lint', 'passed'), task('z#test', 'passed')]),
      fragment([task('z#test', 'failed')], 1),
    ]);
    expect(report.tasks[0]).toMatchObject({
      taskId: 'z#test',
      status: 'failed',
    });
    expect(report.verdict).toBe('failed');
  });

  test('the report id is the fingerprint of the merged task set', () => {
    const tasks = [task('a#lint', 'cached'), task('b#tc', 'passed')];
    expect(mergeFragments([fragment(tasks)]).id).toBe(gateFingerprint(tasks));
  });
});

describe('verdict', () => {
  test('a run that exits non-zero fails with every task green (budget overrun)', () => {
    expect(verdictOf([task('a#test', 'passed')], [1])).toBe('failed');
  });

  test('a planned task no run reached leaves the gate incomplete', () => {
    expect(verdictOf([task('a#test', 'not-run')], [0])).toBe('incomplete');
  });

  test('every task cached or passed is a pass', () => {
    const tasks = [task('a#test', 'cached'), task('b#tc', 'passed')];
    expect(verdictOf(tasks, [0])).toBe('passed');
  });
});

describe('rendering', () => {
  const report = mergeFragments([
    fragment([
      { ...task('a#test', 'failed'), log: 'boom <b>not markup</b>' },
      task('//#ci:specs', 'passed'),
    ]),
  ]);

  test('escapes task logs', () => {
    const html = renderCheckReport(report, {
      inventory: [],
      scenarioHtml: null,
    });
    expect(html).toContain('boom &lt;b&gt;not markup&lt;/b&gt;');
    expect(html).not.toContain('<b>not markup</b>');
  });

  test('embeds the scenario report so it cannot close its script element', () => {
    const scenarioHtml =
      '<html><script>var a = "</script><script>alert(1)</script>";</script></html>';
    const html = renderCheckReport(report, { inventory: [], scenarioHtml });
    const match =
      /<script id="scenario-report" type="application\/json">([\s\S]*?)<\/script>/.exec(
        html
      );
    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? '')).toBe(scenarioHtml);
  });

  test('lists every failed scenario with its failure', () => {
    const withScenarios = {
      ...report,
      specRuns: [
        {
          label: '@libs/friends#test:spec:0',
          cases: [
            {
              file: 'friend-remove.feature.test.ts',
              name: 'Removing a friend ends the friendship',
              line: 3,
              status: 'failed' as const,
              failure: 'expected <ended>',
            },
          ],
          bundle: {
            runId: 'latest',
            status: 'failed' as const,
            updatedAtMs: 0,
            tests: [],
          },
        },
      ],
    };
    const html = renderCheckReport(withScenarios, {
      inventory: [],
      scenarioHtml: null,
    });
    expect(html).toContain('Removing a friend ends the friendship');
    expect(html).toContain('expected &lt;ended&gt;');
  });

  test('says where scenario detail is when no spec part ran', () => {
    const html = renderCheckReport(report, {
      inventory: [],
      scenarioHtml: null,
    });
    expect(html).toContain('bun check:report --restore');
  });
});

describe('collecting a run', () => {
  test('keeps failing and spec-gate logs, and cached tasks stay cached', async () => {
    const root = mkdtempSync(join(tmpdir(), 'check-report-'));
    try {
      mkdirSync(join(root, 'pkgs/a/.turbo'), { recursive: true });
      mkdirSync(join(root, '.turbo'), { recursive: true });
      writeFileSync(
        join(root, 'pkgs/a/.turbo/turbo-test.log'),
        '\u001b[31mred\u001b[0m fail'
      );
      writeFileSync(join(root, '.turbo/turbo-ci:specs.log'), 'specs ok');
      const out = await collectFragment({
        repoRoot: root,
        plan: [
          { taskId: '@pkgs/a#test', hash: 'h1', hit: false },
          { taskId: '//#ci:specs', hash: 'h2', hit: false },
          { taskId: '@pkgs/a#tc', hash: 'h3', hit: true },
        ],
        summary: [
          {
            taskId: '@pkgs/a#test',
            hash: 'h1',
            logFile: 'pkgs/a/.turbo/turbo-test.log',
            cache: { status: 'MISS' },
            execution: { startTime: 1000, endTime: 3500, exitCode: 1 },
          },
          {
            taskId: '//#ci:specs',
            hash: 'h2',
            logFile: '.turbo/turbo-ci:specs.log',
            cache: { status: 'MISS' },
            execution: { startTime: 0, endTime: 100, exitCode: 0 },
          },
        ],
        exitCode: 1,
      });
      const byId = new Map(out.tasks.map((t) => [t.taskId, t]));
      expect(byId.get('@pkgs/a#test')).toMatchObject({
        status: 'failed',
        seconds: 2.5,
        log: 'red fail',
      });
      expect(byId.get('//#ci:specs')).toMatchObject({
        status: 'passed',
        log: 'specs ok',
      });
      expect(byId.get('@pkgs/a#tc')).toMatchObject({
        status: 'cached',
        log: null,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reads only the run summary turbo wrote after the listing', () => {
    const root = mkdtempSync(join(tmpdir(), 'check-report-'));
    try {
      const runs = join(root, '.turbo/runs');
      mkdirSync(runs, { recursive: true });
      writeFileSync(join(runs, 'old.json'), '{"tasks":[{"taskId":"old"}]}');
      const before = runSummaryNames(root);
      expect(readNewRunSummary(root, before)).toBeNull();
      writeFileSync(join(runs, 'new.json'), '{"tasks":[{"taskId":"new"}]}');
      expect(readNewRunSummary(root, before)).toEqual([{ taskId: 'new' }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('turbo-ci-run report flags', () => {
  test('only the check gate renders a report', () => {
    expect(requestsCheck(['check'])).toBe(true);
    expect(requestsCheck(['//#check'])).toBe(true);
    expect(requestsCheck(['lint', '//#lint:root'])).toBe(false);
    expect(requestsCheck(['deploy'])).toBe(false);
  });

  test('reads the fragment path', () => {
    expect(
      reportFragmentPath(['bun', 'x', '--report-fragment=/tmp/f.json', 'a#b'])
    ).toBe('/tmp/f.json');
    expect(reportFragmentPath(['bun', 'x', 'check'])).toBeNull();
    expect(reportFragmentPath(['bun', 'x', '--report-fragment='])).toBeNull();
  });
});
