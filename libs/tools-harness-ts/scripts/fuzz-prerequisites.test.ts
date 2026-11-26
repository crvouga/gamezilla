import { expect, test } from 'bun:test';
import { readTurboTasks } from './turbo-config';

// regression: fuzz-missing-storybook-index
test('coverage builds the Storybook index before replaying its tests', () => {
  expect(readTurboTasks()['//#task:verify:coverage']?.dependsOn).toContain(
    '@pkgs/ui-root-harness-ts#storybook:build'
  );
});
