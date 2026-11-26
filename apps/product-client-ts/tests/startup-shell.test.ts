import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { startupShellIssues } from '@pkgs/ui-root-shared-ts/startup-shell-check';

// regression: startup-shell-palette-drift
test('the boot screen paints design tokens and the activity indicator', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  expect(startupShellIssues(html)).toEqual([]);
});
