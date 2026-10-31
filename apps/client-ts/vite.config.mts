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
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import solid from 'vite-plugin-solid';

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
    // `index.html` spells `%BRAND_NAME%`; the identity fills it in.
    brandHtmlPlugin(),
    feedbackDevPlugin({ repoRoot }),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    // `root.ts` imports the application dynamically (startup error boundary);
    // the page still fetches both at once.
    preloadDynamicEntry('/src/main.tsx'),
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
      watch: workspaceWatchOptions(),
      warmup: {
        clientFiles: [
          './src/root.ts',
          './src/main.tsx',
          './src/base.css',
          '../../pkgs/feedback-client-ts/src/wall.ts',
          '../../pkgs/tailwind-shared-ts/src/tailwind.css',
          '../../pkgs/ui-root-client-ts/src/hosts.css',
        ],
      },
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
      // The application is one eager chunk by design (README.md), so Vite's
      // raw-size warning is expected for it.
      chunkSizeWarningLimit: 2600,
    },
  };
});
