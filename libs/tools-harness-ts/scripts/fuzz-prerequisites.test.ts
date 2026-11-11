import { expect, test } from 'bun:test';
import { readTurboTasks } from './turbo-config';

// regression: fuzz-missing-storybook-index
test.each(['@apps/product-ts#test:fuzz', '//#task:verify:coverage'])(
  '%s builds the Storybook index before replaying its tests',
  (task) => {
    expect(readTurboTasks()[task]?.dependsOn).toContain(
      '@pkgs/ui-root-harness-ts#storybook:build'
    );
  }
);
