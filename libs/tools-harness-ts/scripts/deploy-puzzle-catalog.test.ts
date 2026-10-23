import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Task = {
  readonly cache?: boolean;
  readonly dependsOn?: readonly string[];
};

const ROOT = join(import.meta.dirname, '../../..');

// regression: deploy-unseeded-chess-puzzle-catalog
test('Deploy initializes the puzzle catalog after migration and before shipping', () => {
  const { tasks } = JSON.parse(
    readFileSync(join(ROOT, 'turbo.json'), 'utf8')
  ) as { tasks: Record<string, Task> };
  const initialize = tasks['@libs/chess-puzzle-server-ts#initialize:catalog'];
  expect(initialize?.cache).toBe(false);
  expect(initialize?.dependsOn).toContain('@libs/runtime-server-ts#migrate');
  expect(tasks['@apps/product-ts#deploy']?.dependsOn).toContain(
    '@libs/chess-puzzle-server-ts#initialize:catalog'
  );
  const { scripts } = JSON.parse(
    readFileSync(join(ROOT, 'libs/chess-puzzle-server-ts/package.json'), 'utf8')
  ) as { scripts: Record<string, string> };
  expect(scripts['initialize:catalog']).toBe(
    'bun run scripts/initialize-puzzle-catalog.ts'
  );
});
