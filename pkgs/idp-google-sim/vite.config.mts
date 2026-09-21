// @io-wall-ok — build-tool composition root.
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const repoRoot = resolve(import.meta.dirname, '../..');

/**
 * `@pkgs/ui` carries its own copy ("Loading…") as Lingui macros; the Solid
 * flavour of the config compiles them the way the product's build does.
 */
const linguiConfig = getConfig({
  configPath: resolve(repoRoot, 'lingui.solid.config.ts'),
});

/**
 * Where `bun run web:dev` sends everything that is not the SPA itself. The
 * standalone IdP prints its own origin; `IDP_DEV_ORIGIN` points at it.
 */
const DEV_ORIGIN = process.env['IDP_DEV_ORIGIN'] ?? 'http://127.0.0.1:4319';

const PROXIED = [
  '/rpc',
  '/o/',
  '/token',
  '/tokeninfo',
  '/v1/',
  '/revoke',
  '/oauth2/',
  '/.well-known',
  '/__idp',
  '/idp-assets',
];

export default defineConfig({
  plugins: [
    // `@pkgs/ui/components/<name>` subpaths resolve through array export
    // targets that only Bun honours on its own.
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
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
    tailwindcss(),
  ],
  root: 'web',
  build: {
    target: 'es2022',
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    proxy: Object.fromEntries(
      PROXIED.map((path) => [path, { target: DEV_ORIGIN, changeOrigin: true }])
    ),
  },
});
