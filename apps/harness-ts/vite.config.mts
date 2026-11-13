// @io-wall-ok — build-tool composition root
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { brandHtmlPlugin } from '@libs/product-brand-shared-ts/brand-html';
import { getConfig } from '@lingui/conf';
import { sqliteWebAssets } from '@pkgs/sql-client-sqlite-web-server-ts/sqlite-web-assets';
import { artifactProtection } from '@pkgs/vite-workspace-resolver-server-ts/artifact-protection';
import { rememberTransforms } from '@pkgs/vite-workspace-resolver-server-ts/transform-cache';
import { directoryTransformStore } from '@pkgs/vite-workspace-resolver-server-ts/transform-cache-directory';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver-server-ts/vite-workspace-resolver';
import { workspaceWatchOptions } from '@pkgs/vite-workspace-resolver-server-ts/workspace-watch';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import solid from 'vite-plugin-solid';

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

/**
 * The same three in a built bundle, read where it runs instead of written
 * in: the API is the page's own origin, and the commit is what the deploy
 * stamps into the page (`globalThis.__BUILD__`, absent in a bundle nobody
 * deployed). A bundle therefore depends on its sources alone, never on the
 * commit or the address it is deployed for, so Turborepo restores it for
 * every commit that changes none of them.
 */
const BUILT_ANYWHERE = {
  'import.meta.env.VITE_API_URL': 'globalThis.location.origin',
  'import.meta.env.VITE_COMMIT_HASH': 'globalThis.__BUILD__?.commit',
  'import.meta.env.VITE_COMMIT_DATE': 'globalThis.__BUILD__?.date',
};

/** The compiled message catalog, as `@libs/app-root-shared-ts` imports it. */
const MESSAGES = resolve(
  repoRoot,
  'libs/app-root-shared-ts/locales/en/messages'
);

/**
 * A built bundle loads the compiled messages from the page's own
 * `/messages.js` instead of carrying them: extracting and compiling them
 * takes as long as half the bundle, and this way the two run side by side.
 * Whoever deploys the bundle puts the compiled catalog at that address.
 */
function messagesBesideTheBundle(): PluginOption {
  return {
    name: 'messages-beside-the-bundle',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer === undefined || !source.startsWith('.')) return null;
      return resolve(dirname(importer), source) === MESSAGES
        ? { id: '/messages.js', external: 'absolute' }
        : null;
    },
  };
}

/**
 * Most of a build's time is Babel (Solid's JSX and the Lingui macro) over
 * modules that have not changed since the build before. A build remembers
 * what it made of each one in `.cache/vite-transform`, which the Preview
 * workflow carries from the main branch's build to every pull request's.
 * Whatever decides the output besides a module's own text is in the salt:
 * every dependency's version, this file, the Lingui configuration, the mode.
 */
function rememberedBetweenBuilds(plugin: Plugin, mode: string): Plugin {
  const salt = createHash('sha256');
  for (const part of [
    readFileSync(resolve(repoRoot, 'bun.lock')),
    readFileSync(resolve(harnessDir, 'vite.config.mts')),
    JSON.stringify(linguiConfig),
    mode,
  ])
    salt.update(part).update('\0');
  return rememberTransforms(plugin, {
    store: directoryTransformStore(
      resolve(harnessDir, '.cache/vite-transform')
    ),
    salt: salt.digest('hex'),
    include: /\.[mc]?[tj]sx$/i,
    root: repoRoot,
  });
}

export default defineConfig(({ mode, command }) => {
  const built = command === 'build';
  if (!built) servedBuildEnv();
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
    brandHtmlPlugin(),
    messagesBesideTheBundle(),
    artifactProtection(),
    workspaceExportsResolver({ repoRoot, scopes: DEFAULT_WORKSPACE_SCOPES }),
    sqliteWebAssets({
      repoRoot,
      sqlWorkersDir: resolve(publicDir, 'sql-workers'),
      sqliteWasmDir: resolve(publicDir, 'generated/sqlite-wasm'),
    }),
    tailwindcss(),
    built ? rememberedBetweenBuilds(solidPlugin, mode) : solidPlugin,
  ];
  return {
    root: harnessDir,
    publicDir,
    envPrefix: ['VITE_'],
    plugins,
    define: {
      'import.meta.env.MODE': JSON.stringify(mode),
      ...(built ? BUILT_ANYWHERE : {}),
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
      watch: workspaceWatchOptions(),
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
      outDir: resolve(harnessDir, 'dist'),
      emptyOutDir: true,
      sourcemap: false,
      // Compressing the whole bundle again, only to print its sizes, is
      // time every Preview deploy would wait for.
      reportCompressedSize: false,
      cssCodeSplit: true,
      assetsInlineLimit: 0,
      rolldownOptions: {
        output: {
          // The vendor emulators are most of the bundle. In one chunk with
          // the system, the page spends its first second on a single script:
          // apart, the browser compiles them beside one another, off the
          // main thread, and each is small enough to run between frames.
          codeSplitting: {
            groups: [
              {
                name: (id: string) =>
                  /mockingbird-service-([a-z0-9]+)/.exec(id)?.[1] ?? null,
                test: /[\\/]@crvouga[\\/]mockingbird-service-/,
                maxSize: 600_000,
              },
            ],
          },
        },
      },
    },
  };
});
