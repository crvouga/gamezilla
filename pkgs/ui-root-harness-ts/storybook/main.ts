// @io-wall-ok — Storybook build composition root

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from 'storybook-solidjs-vite';
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
    for (const plugin of config.plugins ?? []) {
      if (plugin && typeof plugin === 'object' && 'name' in plugin)
        configureDocgen(plugin, storyDirectories);
    }
    config.plugins = [
      ...(config.plugins ?? []),
      workspaceExportsResolver({
        repoRoot: root,
        scopes: DEFAULT_WORKSPACE_SCOPES,
      }),
      tailwindcss(),
    ];
    config.optimizeDeps = {
      ...config.optimizeDeps,
      exclude: [...(config.optimizeDeps?.exclude ?? []), '@ui-sdk/core'],
    };
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
