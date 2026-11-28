import { expect, test } from 'bun:test';

// regression: release-document-palette
test('Node can load the first-paint palette used by the Vite config', () => {
  const result = Bun.spawnSync([
    'node',
    '--input-type=module',
    '--eval',
    "import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette'; console.log(withDocumentPalette('var(--ui-color-text)'));",
  ], { cwd: import.meta.dir });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('--ui-color-text:');
});
