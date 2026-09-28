// @io-wall-ok — package boundary rules, run by lint-package.ts (scripts/**).
/**
 * The boundaries that decide what reruns.
 *
 * Turbo builds its graph from `package.json` dependencies, so a package's
 * declared dependencies *are* its blast radius. If the app shell declares a
 * feature, every feature lands in every feature's test closure and
 * per-feature caching quietly stops working — the tests still pass, they just
 * all run, every time, and nobody notices for months. That is why this is a
 * gate and not a convention.
 *
 * The Biome import-boundary rules see one file's specifiers; this also needs
 * the package's manifest, because a declared dependency invalidates the cache
 * even when nothing imports it. So this reads both directly. Each rule reads only its own package,
 * which is what lets it run inside that package's cached `lint`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cross-cutting packages every app needs whatever it was composed from:
 * identity, permission policy, runtime config, the manifest algebra, and the
 * shared test-id constants.
 */
const PLATFORM = [
  '@libs/auth',
  '@libs/client-config',
  '@libs/permissions',
  '@libs/test-ids',
] as const;

/** Bounded contexts. One of these in the shell's graph is the bug. */
const FEATURES = [
  '@libs/billing',
  '@libs/chess',
  '@libs/friends',
  '@libs/games',
  '@libs/notifications',
  '@libs/profile',
  '@libs/search',
  '@libs/spaces',
  '@libs/user-search',
] as const;

/** The one package allowed to know every feature. */
const COMPOSITION_ROOT = '@libs/runtime';

/**
 * Packages that must stay composable from any subset of features: the app
 * shells, and the harness a feature's own e2e boots them through.
 */
const SHELLS = [
  '@libs/client-app',
  '@libs/server-app',
  '@libs/harness',
] as const;

type Rule = {
  readonly forbidden: ReadonlySet<string>;
  readonly why: string;
};

const SHELL_RULE: Rule = {
  forbidden: new Set([...FEATURES, COMPOSITION_ROOT]),
  why: "the shell is what a feature's own e2e boots; naming a feature here puts every feature in every feature's build graph. Contribute through the FeatureClient / FeatureServer fold instead, or declare a port the composition root fills.",
};

const FEATURE_RULE: Rule = {
  forbidden: new Set([COMPOSITION_ROOT]),
  why: 'a feature must not import the composition root — that inverts the fold and drags every other feature in with it.',
};

const RULES: ReadonlyMap<string, Rule> = new Map([
  ...SHELLS.map((pkg) => [pkg, SHELL_RULE] as const),
  ...[...FEATURES, ...PLATFORM].map((pkg) => [pkg, FEATURE_RULE] as const),
  [
    '@libs/feature',
    {
      forbidden: new Set([...FEATURES, COMPOSITION_ROOT, ...SHELLS]),
      why: 'the manifest algebra is generic over what features declare; it may not know one, nor the shells that fold them.',
    },
  ],
]);

type Manifest = {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') sourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SPECIFIER =
  /from\s+'(@libs\/[a-z0-9-]+)(?:\/[^']*)?'|import\('(@libs\/[a-z0-9-]+)(?:\/[^']*)?'\)/g;

/**
 * Every boundary the package at `pkgDir` breaks, as printable lines. Empty for
 * a package no rule names.
 */
export function packageBoundaryViolations(pkgDir: string): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(pkgDir, 'package.json'), 'utf8')
  ) as Manifest;
  const rule = RULES.get(manifest.name ?? '');
  if (rule === undefined) return [];
  const out: string[] = [];
  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
  for (const dep of declared) {
    if (rule.forbidden.has(dep)) out.push(`package.json declares ${dep}`);
  }
  for (const file of sourceFiles(join(pkgDir, 'src'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const dep = match[1] ?? match[2];
      if (dep !== undefined && rule.forbidden.has(dep)) {
        out.push(`${file.slice(pkgDir.length + 1)} imports ${dep}`);
      }
    }
  }
  return out.length === 0 ? [] : [...out, `  why: ${rule.why}`];
}
