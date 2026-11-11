import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { needsBrowser, needsSolver } from './verify-browser-tasks';
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
      task('@pkgs/ui-root-harness-ts#ci:storybook:0'),
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
            '@pkgs/ui-root-harness-ts#ci:storybook:0',
            '@pkgs/ui-root-harness-ts#ci:storybook:3',
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

// regression: storybook-shard-missing-pinned-renderer
test('an uncached Storybook gate installs the renderer used to plan its task hash', () => {
  const storybook: VerifyTask = {
    taskId: '@pkgs/ui-root-harness-ts#ci:storybook:0',
    hash: '0123456789abcdef',
    hit: false,
    source: null,
    dependencies: [],
    command: 'playwright test',
    directory: 'pkgs/ui-root-harness-ts',
    seconds: 1,
    durationSource: 'fallback',
  };
  expect(needsBrowser([storybook])).toBe(true);
  expect(needsBrowser([{ ...storybook, hit: true, source: 'REMOTE' }])).toBe(
    false
  );
});

// regression: auth-shard-missing-solver
test('an uncached auth solver regression provisions pinned model tools', () => {
  const auth = task('@pkgs/auth-root-harness-ts#test');
  expect(needsSolver([auth])).toBe(true);
  expect(needsSolver([{ ...auth, hit: true, source: 'REMOTE' }])).toBe(false);
  expect(needsSolver([task('@pkgs/quint-server-ts#test')])).toBe(true);
  expect(needsSolver([task('@libs/auth-client-ts#test')])).toBe(false);
});
