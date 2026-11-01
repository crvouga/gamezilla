import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// regression: fuzz-missing-storybook-index
test.each(['@apps/product-ts#test:fuzz', '//#task:verify:coverage'])(
  '%s builds the Storybook index before replaying its tests',
  (task) => {
    const turbo = JSON.parse(
      readFileSync(new URL('../../../turbo.json', import.meta.url), 'utf8')
    ) as { tasks: Record<string, { dependsOn?: string[] }> };
    expect(turbo.tasks[task]?.dependsOn).toContain(
      '@pkgs/ui-root-harness-ts#storybook:build'
    );
  }
);
