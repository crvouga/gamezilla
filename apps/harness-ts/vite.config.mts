// @io-wall-ok — build-tool composition root
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { brandHtmlPlugin } from '@libs/product-brand-shared-ts/brand-html';
import { getConfig } from '@lingui/conf';
import { sqliteWebAssets } from '@pkgs/sql-client-sqlite-web-server-ts/sqlite-web-assets';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';
import { inlineDocumentFragments } from '@pkgs/vite-workspace-resolver-server-ts/inline-document-fragments';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import { workspaceWatchOptions } from '@pkgs/vite-workspace-resolver-server-ts/workspace-watch';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type PluginOption } from 'vite';

const harnessDir = import.meta.dirname;
const repoRoot = resolve(harnessDir, '../..');
const publicDir = resolve(harnessDir, 'public');

const linguiConfig = getConfig({
  configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
});

const DEV_PORT = Number(process.env['VITE_PORT'] ?? 5174);

function git(args: readonly string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

/**
 * What the embedded application reads from its build, when served by `vite`.
 * The harness has no servers behind it, so its API is its own origin
 * (answered in the tab) and the commit is the checkout's.
 */
function servedBuildEnv(): void {
  process.env['VITE_API_URL'] ??= `http://localhost:${String(DEV_PORT)}`;
  process.env['VITE_COMMIT_HASH'] ??= git(['rev-parse', 'HEAD']);
  process.env['VITE_COMMIT_DATE'] ??= git(['log', '-1', '--format=%cI']);
}

const canvasColor = JSON.stringify(COLOR_PALETTE.background);

export default defineConfig(({ mode }) => {
  servedBuildEnv();
  const solidPlugin = solid({
    babel: {
      plugins: [
        [
          '@lingui/babel-plugin-lingui-macro',
          { descriptorFields: 'all', linguiConfig },
        ],
      ],
    },
  });
  const plugins: PluginOption[] = [
    // `index.html` spells `%BRAND_NAME%`; the identity fills it in.
    inlineDocumentFragments(
      { 'opening.css': resolve(harnessDir, 'src/opening.css') },
      withDocumentPalette
    ),
    brandHtmlPlugin(),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    sqliteWebAssets({
      repoRoot,
      sqlWorkersDir: resolve(publicDir, 'sql-workers'),
      sqliteWasmDir: resolve(publicDir, 'generated/sqlite-wasm'),
    }),
    tailwindcss(),
    solidPlugin,
  ];
  return {
    root: harnessDir,
    publicDir,
    envPrefix: ['VITE_'],
    plugins,
    define: {
      'import.meta.env.APP_CANVAS_COLOR': canvasColor,
      'import.meta.env.MODE': JSON.stringify(mode),
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
      watch: workspaceWatchOptions(),
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm', '@ui-sdk/core'],
    },
  };
});
