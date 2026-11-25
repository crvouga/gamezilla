import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import type { JSX } from '@solidjs/web';
import { renderUi } from './render';

// regression: storybook-lingui-macro-lowered-before-translation
// regression: storybook-preset-solid-compiler-skips-lingui
// regression: storybook-vite-config-imported-in-browser
test('the preview uses one Solid compiler and renders the translated Unrated game fact', async () => {
  const build = Bun.spawnSync(
    [process.execPath, resolve(import.meta.dir, 'storybook-lingui-fixture.ts')],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  expect(build.exitCode, build.stderr.toString()).toBe(0);
  const { code, pluginNames } = JSON.parse(build.stdout.toString()) as {
    code: string;
    pluginNames: string[];
  };
  expect(pluginNames.filter((name) => name === 'solid')).toHaveLength(1);
  const built = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as { unrated: () => JSX.Element };
  const screen = renderUi(built.unrated);
  expect(screen.getByText('Unrated')).toBeInTheDocument();
});
