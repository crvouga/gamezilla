// @io-wall-ok — build-tool composition root
import { resolve } from 'node:path';
import { brandHtmlPlugin } from '@libs/product-brand-shared-ts/brand-html';
import { getConfig } from '@lingui/conf';
import { sqliteWebAssets } from '@pkgs/sql-client-sqlite-web-server-ts/sqlite-web-assets';
import { artifactProtection } from '@pkgs/vite-workspace-resolver-server-ts/artifact-protection';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const repoRoot = resolve(root, '../..');
const linguiConfig = getConfig({
  configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
});

export default defineConfig({
  root,
  server: {
    proxy: process.env['LOCAL_ADMIN_API_ORIGIN']
      ? { '/api': process.env['LOCAL_ADMIN_API_ORIGIN'] }
      : {},
  },
  plugins: [
    brandHtmlPlugin(),
    artifactProtection(),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    sqliteWebAssets({
      repoRoot,
      sqlWorkersDir: resolve(root, 'public/sql-workers'),
    }),
    tailwindcss(),
    solid({
      babel: {
        plugins: [
          [
            '@lingui/babel-plugin-lingui-macro',
            { descriptorFields: 'all', linguiConfig },
          ],
        ],
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
  worker: { format: 'es' },
});
