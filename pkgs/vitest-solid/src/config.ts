// @io-wall-ok — test-tool composition root
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import {
  DEFAULT_WORKSPACE_SCOPES,
  workspaceExportsResolver,
} from '@pkgs/vite-workspace-resolver';
import solid from 'vite-plugin-solid';
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
// Babel resolves plugin names from the consumer's cwd; pin ours by path.
const LINGUI_MACRO_PLUGIN = createRequire(import.meta.url).resolve(
  '@lingui/babel-plugin-lingui-macro'
);
const LINGUI_SOLID_CONFIG = resolve(REPO_ROOT, 'lingui.solid.config.ts');

type PackageManifest = {
  readonly name?: string;
  readonly exports?: Readonly<Record<string, unknown>>;
};

/**
 * Tests are black-box against the package `exports` (`@pkgs/x/solid`), but a
 * package cannot resolve itself through node_modules under Vite. Alias each
 * string export subpath to its source file so self-imports resolve.
 */
type Alias = { readonly find: RegExp; readonly replacement: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selfReferenceAliases(root: string): readonly Alias[] {
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8')
  ) as PackageManifest;
  const aliases: Alias[] = [];
  if (manifest.name === undefined || manifest.exports === undefined) {
    return aliases;
  }
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    const specifier =
      subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`;
    if (subpath.includes('*')) {
      // `./*` → `./src/*.ts(x)`: map the wildcard to an extension-less path
      // and let Vite's `resolve.extensions` pick the file.
      const first = Array.isArray(target) ? target[0] : target;
      if (typeof first !== 'string') continue;
      const dir = first.slice(0, first.indexOf('*'));
      const [head, tail = ''] = specifier.split('*');
      aliases.push({
        find: new RegExp(
          `^${escapeRegExp(head ?? '')}(.*)${escapeRegExp(tail)}$`
        ),
        replacement: `${resolve(root, dir)}/$1`,
      });
      continue;
    }
    if (typeof target !== 'string') continue;
    aliases.push({
      find: new RegExp(`^${escapeRegExp(specifier)}$`),
      replacement: resolve(root, target),
    });
  }
  return aliases;
}

export type SolidVitestOptions = {
  /** Package root (directory containing `vitest.config.mts`). */
  readonly root: string;
  /** Test globs relative to `root`; default `**\/*.test.tsx`. */
  readonly include?: readonly string[];
  /** Extra Vitest / Vite config merged on top of the defaults. */
  readonly overrides?: ViteUserConfig;
};

/**
 * Shared Vitest config for Solid packages: `vite-plugin-solid` with the Lingui
 * macro, happy-dom, jest-dom matchers, auto-cleanup. `*.test.tsx` = Vitest DOM
 * tests; plain `*.test.ts` stay on `bun test`.
 */
export function defineSolidVitestConfig(
  options: SolidVitestOptions
): ViteUserConfig {
  const linguiConfig = getConfig({ configPath: LINGUI_SOLID_CONFIG });
  const base = defineConfig({
    root: options.root,
    resolve: {
      conditions: ['development', 'browser'],
      alias: [...selfReferenceAliases(options.root)],
    },
    plugins: [
      workspaceExportsResolver({
        repoRoot: REPO_ROOT,
        scopes: DEFAULT_WORKSPACE_SCOPES,
      }),
      solid({
        babel: {
          plugins: [
            [LINGUI_MACRO_PLUGIN, { descriptorFields: 'all', linguiConfig }],
          ],
        },
      }),
    ],
    test: {
      environment: 'happy-dom',
      include: [...(options.include ?? ['**/*.test.tsx'])],
      exclude: ['**/node_modules/**', '**/dist/**'],
      // Bare imports in the setup file resolve from the consumer package, so
      // consumers list `@testing-library/jest-dom` + `@solidjs/testing-library`.
      setupFiles: [resolve(import.meta.dirname, 'setup.ts')],
      passWithNoTests: false,
    },
  });
  return options.overrides === undefined
    ? base
    : mergeConfig(base, options.overrides);
}
