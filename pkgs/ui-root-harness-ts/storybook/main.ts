// @io-wall-ok — Storybook build composition root

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from 'storybook-solidjs-vite';
import solid from 'vite-plugin-solid';
import { configureDocgen } from './docgen';

const root = resolve(import.meta.dirname, '../../..');
const storyDirectories = readdirSync(resolve(root, 'pkgs'))
  .filter(
    (name) =>
      name.endsWith('-client-ts') &&
      existsSync(resolve(root, 'pkgs', name, 'src')) &&
      readdirSync(resolve(root, 'pkgs', name, 'src'), {
        recursive: true,
      }).some((file) => String(file).endsWith('.stories.tsx'))
  )
  .sort()
  .map((name) => resolve(root, 'pkgs', name, 'src'));
const config: StorybookConfig = {
  framework: 'storybook-solidjs-vite',
  stories: [
    '../storybook/introduction.mdx',
    ...storyDirectories.map((directory) => ({
      directory,
      files: '**/*.stories.tsx',
    })),
  ],
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
    for (const plugin of config.plugins ?? []) {
      if (plugin && typeof plugin === 'object' && 'name' in plugin)
        configureDocgen(plugin, storyDirectories);
    }
    config.plugins = [
      ...(config.plugins ?? []).filter(
        (plugin) =>
          !(
            plugin &&
            typeof plugin === 'object' &&
            'name' in plugin &&
            plugin.name === 'solid'
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
      dedupe: ['solid-js', '@lingui/core', '@lingui/solid'],
    };
    config.define = {
      ...config.define,
      'import.meta.env.VITE_TEST_HOOKS': 'true',
    };
    return config;
  },
};
export default config;
