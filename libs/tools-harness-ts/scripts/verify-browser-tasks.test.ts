import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { needsBrowser } from './verify-browser-tasks';
import type { VerifyTask } from './verify-shards';

function task(taskId: string, hit = false): VerifyTask {
  return {
    taskId,
    hash: '0123456789abcdef',
    hit,
    source: hit ? 'REMOTE' : null,
    command: 'bun test',
    directory: 'pkgs/ui-root-harness-ts',
    seconds: 1,
    durationSource: 'history',
    dependencies: [],
  };
}

test('the Storybook verification shard installs the planned renderer', () => {
  // regression: storybook-shard-missing-renderer
  expect(
    needsBrowser([
      task('@pkgs/ui-root-harness-ts#storybook:coverage'),
      task('@pkgs/ui-root-harness-ts#test'),
      task('@pkgs/ui-root-harness-ts#ci:storybook'),
    ])
  ).toBe(true);
});

test('browser checks request setup exactly when an assigned check must run', () => {
  assertProperty(
    'verify-browser-task-selection',
    fc.property(
      fc.array(
        fc.record({
          taskId: fc.constantFrom(
            '@pkgs/ui-root-harness-ts#ci:storybook',
            '@pkgs/ui-root-harness-ts#storybook:test',
            '@pkgs/ui-root-harness-ts#storybook:mcp:test',
            '@pkgs/ui-testing-bun-webview-server-ts#test'
          ),
          hit: fc.boolean(),
        })
      ),
      (checks) => {
        const tasks = checks.map(({ taskId, hit }) => task(taskId, hit));
        tasks.push(task('@pkgs/ui-root-harness-ts#storybook:coverage'));
        tasks.push(task('@pkgs/ui-root-harness-ts#test'));
        expect(needsBrowser(tasks)).toBe(checks.some(({ hit }) => !hit));
        expect(needsBrowser(tasks.reverse())).toBe(
          checks.some(({ hit }) => !hit)
        );
      }
    )
  );
});
