import { expect, test } from 'bun:test';
import { relative, resolve } from 'node:path';
import { UI_QUALITY_MODEL_DIR } from '@apps/product/ui-quality/model-location';

// regression: ui-quality-model-installed-outside-worktree
test('model setup stays in the worktree cache used by the offline checker', () => {
  const repository = resolve(import.meta.dir, '../../..');
  expect(relative(repository, UI_QUALITY_MODEL_DIR).replaceAll('\\', '/')).toBe(
    '.cache/ui-quality-model'
  );
});
