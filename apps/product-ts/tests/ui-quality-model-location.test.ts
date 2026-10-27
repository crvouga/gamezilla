import { expect, test } from 'bun:test';
import { relative, resolve } from 'node:path';
import { UI_QUALITY_MODEL_DIR } from '@apps/product-ts/ui-quality/model-location';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

// regression: ui-quality-model-installed-outside-worktree
test('model setup stays in the worktree cache used by the offline checker', () => {
  const repository = resolve(import.meta.dir, '../../..');
  expect(slashPath(relative(repository, UI_QUALITY_MODEL_DIR))).toBe(
    '.cache/ui-quality-model'
  );
});
