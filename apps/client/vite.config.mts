// @io-wall-ok — build-tool composition root
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver';
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
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
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
    },
  };
});
