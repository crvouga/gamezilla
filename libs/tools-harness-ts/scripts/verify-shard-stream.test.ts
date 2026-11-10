import { expect, test } from 'bun:test';
import { redactSecrets, taskStream } from './verify-shard-stream';
import type { VerifyTask } from './verify-shards';

const TASK: VerifyTask = {
  taskId: '@libs/tools-harness-ts#tc',
  directory: 'libs/tools-harness-ts',
  command:
    'tsc --noEmit --incremental --tsBuildInfoFile .cache/tc.tsbuildinfo -p ./tsconfig.tc.json',
  hash: '0123456789abcdef',
  hit: false,
  source: null,
  dependencies: [],
  seconds: 10,
  durationSource: 'fallback',
};

// regression: verify-typescript-diagnostics-hidden
test.each([
  [
    'command exit',
    'error',
    'command (/home/runner/work/repo/repo/libs/tools-harness-ts) /home/runner/bun run tc exited (2)',
  ],
  ['final failure summary', 'info', 'Failed:    @libs/tools-harness-ts#tc'],
])(
  'Turbo %s exposes ordinary compiler output and retires the failed task',
  (_name, level, text) => {
    let now = 0;
    const logs: string[] = [];
    const stream = taskStream(
      [TASK, { ...TASK, taskId: '@libs/other#tc', directory: 'libs/other' }],
      (line) =>
        logs.push(
          redactSecrets(line, {
            TURBO_TOKEN: 'compiler-secret',
          })
        ),
      { now: () => now, completed: () => false }
    );
    const send = (source: string, level: string, text: string) =>
      stream(
        JSON.stringify({
          timestamp: 1792763789773,
          source,
          level,
          text,
        })
      );
    send(TASK.taskId, 'stdout', 'cache miss, executing 0123456789abcdef');
    send(
      TASK.taskId,
      'stdout',
      'scripts/check.ts(1,1): error TS2322: Type string is not assignable to number.'
    );
    send(TASK.taskId, 'stderr', 'compiler stderr context compiler-secret');
    send('@libs/other#tc', 'stdout', 'passing output stays quiet');
    send('turbo', 'warn', 'command finished with error, but continuing...');
    expect(logs.join('\n')).not.toContain('error TS2322');
    now = 8197;
    send('turbo', level!, text!);
    send('turbo', 'info', 'Failed:    @libs/tools-harness-ts#tc');
    expect(logs.join('\n')).toContain('error TS2322');
    expect(logs.join('\n')).toContain('compiler stderr context [REDACTED]');
    expect(logs.join('\n')).not.toContain('compiler-secret');
    expect(logs.join('\n')).not.toContain('passing output stays quiet');
    expect(logs.filter((line) => line.startsWith('FAILED '))).toHaveLength(1);
    expect(stream.snapshot().failed.map((task) => task.taskId)).toEqual([
      TASK.taskId,
    ]);
    expect(stream.snapshot().running).toEqual([]);
    now = 1_000_000;
    expect(stream.tick()).toEqual([]);
  }
);

// regression: verify-uncached-dependency-reported-as-timeout — the gate's
// `storybook:coverage` (`cache: false`) finished in seconds, but with no
// cache artifact the stream kept it "running" while its dependent
// `ci:storybook` ran, then reported it over its 2400s budget and stopped
// the shard.
test('an uncached task is complete once a task depending on it starts', () => {
  let now = 0;
  const logs: string[] = [];
  const coverage: VerifyTask = {
    ...TASK,
    taskId: '@pkgs/ui-root-harness-ts#storybook:coverage',
    directory: 'pkgs/ui-root-harness-ts',
    command: 'bun scripts/storybook-coverage.ts',
    cacheable: false,
  };
  const storybook: VerifyTask = {
    ...coverage,
    taskId: '@pkgs/ui-root-harness-ts#ci:storybook',
    command: 'playwright test -c storybook/playwright.config.ts',
    cacheable: true,
    dependencies: [coverage.taskId],
  };
  const stream = taskStream([coverage, storybook], (line) => logs.push(line), {
    now: () => now,
    completed: () => false,
  });
  const send = (source: string, text: string) =>
    stream(JSON.stringify({ source, level: 'stdout', text }));
  send(coverage.taskId, 'cache bypass, force executing c2eaebb638761');
  now = 21_000;
  send(storybook.taskId, 'cache miss, executing 1f08d1479');
  expect(logs).toContain(
    `COMPLETE ${coverage.taskId}; elapsed: 21.0s; finished before ${storybook.taskId} started`
  );
  expect(stream.snapshot().running.map((task) => task.taskId)).toEqual([
    storybook.taskId,
  ]);
  now = 2_401_000;
  expect(stream.tick()).not.toContain(coverage.taskId);
});
