// @io-wall-ok — Storybook build composition root

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from 'storybook-solidjs-vite';
import type { PluginOption } from 'vite';
import { configureDocgen } from './docgen';
import { previewAnnotations } from './entrypoints';

const root = resolve(import.meta.dirname, '../../..');
/** Design-system slices live in `pkgs/`; product screen views live in `libs/`. */
const storyDirectories = ['pkgs', 'libs']
  .flatMap((tier) =>
    readdirSync(resolve(root, tier))
      .filter(
        (name) =>
          name.endsWith('-client-ts') &&
          existsSync(resolve(root, tier, name, 'src')) &&
          readdirSync(resolve(root, tier, name, 'src'), {
            recursive: true,
          }).some((file) => String(file).endsWith('.stories.tsx'))
      )
      .map((name) => resolve(root, tier, name, 'src'))
  )
  .sort();
/** Every plugin `@solidjs/vite-plugin` (alias `vite-plugin-solid`) registers. */
function isSolidCompilerPlugin(name: string): boolean {
  return name === 'solid' || name.startsWith('solid:');
}

/** Vite accepts nested plugin arrays; a plugin factory may return one. */
export function flattenPlugins(
  plugins: readonly PluginOption[]
): PluginOption[] {
  return plugins.flatMap((plugin) =>
    Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin]
  );
}

const config: StorybookConfig = {
  framework: 'storybook-solidjs-vite',
  stories: [
    '../storybook/introduction.mdx',
    ...storyDirectories.map((directory) => ({
      directory,
      files: '**/*.stories.tsx',
    })),
  ],
  previewAnnotations: previewAnnotations.map((path) => resolve(root, path)),
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-mcp',
  ],
  features: {
    componentsManifest: true,
    sidebarOnboardingChecklist: false,
    menuOnboardingChecklist: false,
  },
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // The framework preset adds its own Solid compiler as a nested plugin
    // array. Flatten before filtering, or it survives without the Lingui
    // macro pass and compiles `<Trans>` before the macro can see it.
    const plugins = flattenPlugins(config.plugins ?? []);
    for (const plugin of plugins) {
      if (plugin && typeof plugin === 'object' && 'name' in plugin)
        configureDocgen(plugin, storyDirectories);
    }
    config.plugins = [
      ...plugins.filter(
        (plugin) =>
          !(
            plugin &&
            typeof plugin === 'object' &&
            'name' in plugin &&
            isSolidCompilerPlugin(plugin.name)
          )
      ),
      workspaceExportsResolver({
        repoRoot: root,
        scopes: DEFAULT_WORKSPACE_SCOPES,
      }),
      tailwindcss(),
      solid({
        babel: {
          plugins: [
            [
              '@lingui/babel-plugin-lingui-macro',
              {
                descriptorFields: 'all',
                linguiConfig: getConfig({
                  configPath: resolve(root, 'lingui.solid.config.ts'),
                }),
              },
            ],
          ],
        },
      }),
    ];
    config.resolve = {
      ...config.resolve,
      dedupe: ['solid-js', '@solidjs/web', '@lingui/core'],
    };
    config.define = {
      ...config.define,
      'import.meta.env.VITE_TEST_HOOKS': 'true',
    };
    return config;
  },
};
export default config;
