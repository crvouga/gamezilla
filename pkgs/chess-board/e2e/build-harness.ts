// @io-wall-ok — build-tool composition root for the e2e harness page.
/**
 * Builds the chess board harness page (Solid + Lingui + Tailwind, as the app
 * builds it) into a static directory the WebView host serves.
 */

import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'vite';
import solid from 'vite-plugin-solid';

const HERE = import.meta.dirname;
const REPO_ROOT = resolve(HERE, '../../..');

const HARNESS_OUT_DIR = resolve(HERE, '../node_modules/.cache/chess-board-e2e');

export async function buildHarness(): Promise<string> {
  const linguiConfig = getConfig({
    configPath: resolve(REPO_ROOT, 'lingui.solid.config.ts'),
  });
  await build({
    root: resolve(HERE, 'harness'),
    base: './',
    logLevel: 'warn',
    configFile: false,
    // Keep E2E DOM identifiers (`data-component`, paint tokens) in the build.
    define: { 'import.meta.env.VITE_E2E': JSON.stringify('1') },
    plugins: [
      workspaceExportsResolver({
        repoRoot: REPO_ROOT,
        scopes: DEFAULT_WORKSPACE_SCOPES,
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
    build: {
      outDir: HARNESS_OUT_DIR,
      emptyOutDir: true,
      target: 'es2022',
      minify: false,
      sourcemap: true,
    },
  });
  return HARNESS_OUT_DIR;
}
