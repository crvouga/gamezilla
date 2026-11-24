import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

// regression: storybook-preset-solid-compiler-skips-lingui
// regression: storybook-vite-config-imported-in-browser
test('the Storybook build replaces the preset Solid compiler with its Lingui-aware compiler', () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      resolve(import.meta.dir, 'storybook-vite-plugin-names.ts'),
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const names = result.stdout.toString().split('\n');
  expect(names.filter((name) => name === 'solid')).toHaveLength(1);
  expect(names.filter((name) => name === 'solid:diagnostics')).toHaveLength(1);
});
