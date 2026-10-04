// @io-wall-ok — build-tool composition root
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import { feedbackDevPlugin } from '@pkgs/feedback-server/vite';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import solid from 'vite-plugin-solid';
import { sqliteWebAssets } from '../../pkgs/sql-client-sqlite-web-server/scripts/sqlite-web-assets';

const clientDir = import.meta.dirname;
const repoRoot = resolve(clientDir, '../..');

/**
 * Lingui macro output is JSX-runtime specific; the Solid flavour lives in
 * `lingui.solid.config.ts` (same catalogs as the root config).
 */
const linguiConfig = getConfig({
  configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
});

/** Keep `message` on descriptors so a missing catalog key renders English, not a hash. */
export const linguiMacroPlugin = [
  '@lingui/babel-plugin-lingui-macro',
  { descriptorFields: 'all', linguiConfig },
] as const;

const DEV_PORT = 8081;

export default defineConfig(({ mode }) => {
  const analyze = process.env['ANALYZE'] === '1';
  const plugins: PluginOption[] = [
    feedbackDevPlugin({ repoRoot }),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    sqliteWebAssets({
      repoRoot,
      sqlWorkersDir: resolve(clientDir, 'public/sql-workers'),
    }),
    tailwindcss(),
    solid({
      babel: {
        plugins: [[linguiMacroPlugin[0], { ...linguiMacroPlugin[1] }]],
      },
    }),
  ];
  if (analyze) {
    plugins.push(
      visualizer({
        filename: resolve(clientDir, 'dist/.stats.html'),
        gzipSize: true,
        brotliSize: false,
        template: 'treemap',
      }) as PluginOption
    );
  }
  return {
    root: clientDir,
    publicDir: resolve(clientDir, 'public'),
    envPrefix: ['VITE_'],
    plugins,
    define: {
      'import.meta.env.MODE': JSON.stringify(mode),
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
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
      outDir: resolve(clientDir, 'dist'),
      emptyOutDir: true,
      manifest: true,
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 0,
      // node-sql-parser is one atomic browser module (~2.4 MB raw / ~428 KB
      // gzip); it cannot be split further, so keep Vite's raw-size warning
      // above it.
      chunkSizeWarningLimit: 2600,
      // Do not inject <link rel="modulepreload"> for dynamic-import targets into
      // index.html. Vite's default preloads the sync-engine / mutations /
      // dicebear / games graphs on every cold load and blew Slow-4G LCP (~35s).
      // Chunks still load when actually imported; JS hosts may still preload.
      modulePreload: {
        resolveDependencies: (_filename, deps, { hostType }) =>
          hostType === 'html' ? [] : deps,
      },
    },
  };
});
