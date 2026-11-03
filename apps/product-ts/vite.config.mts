// @io-wall-ok — build-tool composition root
import { resolve } from 'node:path';
import { brandHtmlPlugin } from '@libs/product-identity-shared-ts/brand-html';
import { getConfig } from '@lingui/conf';
import { feedbackDevPlugin } from '@pkgs/feedback-server-ts/vite';
import { sqliteWebAssets } from '@pkgs/sql-client-sqlite-web-server-ts/sqlite-web-assets';
import { preloadDynamicEntry } from '@pkgs/vite-workspace-resolver-server-ts/preload-dynamic-entry';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import { workspaceWatchOptions } from '@pkgs/vite-workspace-resolver-server-ts/workspace-watch';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type PluginOption } from 'vite';
import solid from 'vite-plugin-solid';

const consoleDir = import.meta.dirname;
const repoRoot = resolve(consoleDir, '../..');
// Release partitions generate SQLite assets beside their own static inputs.
const publicDir = resolve(
  consoleDir,
  process.env['PRODUCT_PUBLIC_DIR'] ?? 'public'
);

const linguiConfig = getConfig({
  configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
});

/** `.superset/port.sh` exports `VITE_PORT` so parallel workspaces don't collide. */
const DEV_PORT = Number(process.env['VITE_PORT'] ?? 5173);

/**
 * A localhost stack under test serves a fixed snapshot of the app: no HMR, no
 * file watching, so an edit in the working tree cannot reload a browser that
 * a test is driving.
 */
const FROZEN = process.env['PRODUCT_DEV_FROZEN'] === '1';

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    // `index.html` spells `%BRAND_NAME%`; the identity fills it in.
    brandHtmlPlugin(),
    feedbackDevPlugin({ repoRoot }),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    // `root.ts` imports the application dynamically (startup error boundary);
    // the page still fetches both at once.
    preloadDynamicEntry('/src/main.tsx'),
    sqliteWebAssets({
      repoRoot,
      sqlWorkersDir: resolve(publicDir, 'sql-workers'),
      sqliteWasmDir: resolve(publicDir, 'generated/sqlite-wasm'),
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
  ];
  return {
    root: consoleDir,
    publicDir,
    envPrefix: ['VITE_'],
    plugins,
    define: {
      'import.meta.env.MODE': JSON.stringify(mode),
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
      watch: workspaceWatchOptions(),
      warmup: {
        clientFiles: [
          './src/root.ts',
          './src/main.tsx',
          './src/styles.css',
          '../../pkgs/feedback-client-ts/src/wall.ts',
          '../../pkgs/tailwind-shared-ts/src/tailwind.css',
          '../../pkgs/ui-root-client-ts/src/hosts.css',
        ],
      },
      ...(FROZEN ? { hmr: false, watch: null } : {}),
    },
    preview: {
      port: DEV_PORT,
      strictPort: true,
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm'],
    },
    build: {
      target: 'es2022',
      outDir: resolve(consoleDir, 'dist'),
      emptyOutDir: true,
      manifest: true,
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 0,
    },
  };
});
