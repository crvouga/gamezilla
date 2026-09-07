// @io-wall-ok — build-tool composition root
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver';
import { defineConfig, type PluginOption } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';

const consoleDir = import.meta.dirname;
const repoRoot = resolve(consoleDir, '../..');

const linguiConfig = getConfig({
  configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
});

const DEV_PORT = 5173;

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
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
    publicDir: resolve(consoleDir, 'public'),
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
      outDir: resolve(consoleDir, 'dist'),
      emptyOutDir: true,
      manifest: true,
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 0,
      // Node-only sim sidecars are lazily imported (fidelity-max) and never
      // run in the browser console; keep them out of the web graph entirely.
      rolldownOptions: {
        external: ['embedded-postgres', '@embedded-postgres/*'],
      },
    },
  };
});
