import { expect, test } from 'bun:test';
import { needsBrowser } from './verify-browser-tasks';
import type { VerifyTask } from './verify-shards';

// regression: storybook-shard-missing-pinned-renderer
test('an uncached Storybook gate installs the renderer used to plan its task hash', () => {
  const storybook: VerifyTask = {
    taskId: '@pkgs/ui-root-harness-ts#ci:storybook',
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
