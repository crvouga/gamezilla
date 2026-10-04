// @io-wall-ok — build-tool composition root
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import { feedbackDevPlugin } from '@pkgs/feedback-server/vite';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type PluginOption } from 'vite';
import solid from 'vite-plugin-solid';
import { sqliteWebAssets } from '../../pkgs/sql-client-sqlite-web-server/scripts/sqlite-web-assets';
import { reportsDevPlugin } from './scripts/reports-dev-plugin.ts';

const consoleDir = import.meta.dirname;
const repoRoot = resolve(consoleDir, '../..');

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
    feedbackDevPlugin({ repoRoot }),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    sqliteWebAssets({
      repoRoot,
      sqlWorkersDir: resolve(consoleDir, 'public/sql-workers'),
      sqliteWasmDir: resolve(consoleDir, 'public/generated/sqlite-wasm'),
    }),
    tailwindcss(),
    reportsDevPlugin({
      repoRoot,
      appModule: resolve(consoleDir, 'scripts/reports-dev-app.ts'),
    }),
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
    publicDir: resolve(consoleDir, 'public'),
    envPrefix: ['VITE_'],
    plugins,
    define: {
      'import.meta.env.MODE': JSON.stringify(mode),
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
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
      // Node-only harness sidecars are lazily imported (fidelity-max) and never
      // run in the browser console; keep them out of the web graph entirely.
      rolldownOptions: {
        external: ['embedded-postgres', '@embedded-postgres/*'],
      },
    },
  };
});
