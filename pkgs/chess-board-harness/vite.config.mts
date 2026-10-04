// @io-wall-ok — browser conformance build composition root.

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import { workspaceExportsResolver } from '@pkgs/vite-workspace-resolver-server/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const require = createRequire(import.meta.url);
const repoRoot = resolve(import.meta.dirname, '../..');
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/harness/browser'),
  plugins: [
    workspaceExportsResolver({ repoRoot, scopes: { '@pkgs': 'pkgs' } }),
    tailwindcss(),
    solid({
      babel: {
        plugins: [
          [
            require.resolve('@lingui/babel-plugin-lingui-macro'),
            {
              descriptorFields: 'all',
              linguiConfig: getConfig({
                configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
              }),
            },
          ],
        ],
      },
    }),
  ],
  define: { 'import.meta.env.VITE_TEST_HOOKS': '"1"' },
  build: {
    outDir: resolve(import.meta.dirname, '.cache/browser-app'),
    emptyOutDir: true,
  },
});
