import { expect, test } from 'bun:test';
import solid from '@solidjs/vite-plugin';
import type { PluginOption } from 'vite';
import config, { flattenPlugins } from '../storybook/main';

function pluginNames(plugins: readonly PluginOption[]): string[] {
  return flattenPlugins(plugins).flatMap((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin
      ? [plugin.name]
      : []
  );
}

// regression: storybook-preset-solid-compiler-skips-lingui
test('the framework preset Solid compiler is replaced, so only the Lingui-aware one compiles stories', async () => {
  const viteFinal = config.viteFinal;
  if (!viteFinal) throw new Error('Storybook has no Vite composition');
  // The framework preset registers its compiler as one nested plugin array.
  const final = await viteFinal({ plugins: [solid()] }, {} as never);
  const names = pluginNames(final.plugins ?? []);
  expect(names.filter((name) => name === 'solid')).toHaveLength(1);
  expect(names.filter((name) => name === 'solid:diagnostics')).toHaveLength(1);
});
