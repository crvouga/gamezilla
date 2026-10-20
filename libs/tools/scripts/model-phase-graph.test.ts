import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { specPackages } from './spec-packages';

const REPO_ROOT = join(import.meta.dirname, '../../..');

// regression: split-model-phases-missing-gate
// regression: custom-game-induction-task-exceeds-capacity
test('every split model gates all its phases through the selected parent task', () => {
  for (const pkg of specPackages()) {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, pkg.dir, 'package.json'), 'utf8')
    ) as { phaseParts?: Record<string, number> };
    if (manifest.phaseParts === undefined) continue;
    const config = JSON.parse(
      readFileSync(join(REPO_ROOT, pkg.dir, 'turbo.json'), 'utf8')
    ) as { tasks: Record<string, { dependsOn?: string[]; cache?: boolean }> };
    for (const [part, count] of Object.entries(manifest.phaseParts)) {
      const parent = `verify:models:${part}`;
      expect(config.tasks[parent]?.dependsOn, `${pkg.name}#${parent}`).toEqual(
        Array.from({ length: count }, (_, index) => `${parent}:${index}`)
      );
      expect(config.tasks[parent]?.cache).toBe(false);
    }
  }
});
