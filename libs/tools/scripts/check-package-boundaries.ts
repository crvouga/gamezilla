// @io-wall-ok — package boundary CLI entry root (scripts/**).
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
 * depcruise cannot help here: it resolves relative paths, and these imports
 * are workspace aliases (its own config says so). So this check reads the
 * manifests and the import specifiers directly.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..');

/**
 * Cross-cutting packages every app needs whatever it was composed from:
 * identity, permission policy, runtime config, the manifest algebra, and the
 * shared test-id constants.
 */
const PLATFORM = new Set([
  '@libs/auth',
  '@libs/client-config',
  '@libs/feature',
  '@libs/permissions',
  '@libs/test-ids',
]);

/** Bounded contexts. One of these in the shell's graph is the bug. */
const FEATURES = new Set([
  '@libs/billing',
  '@libs/chess',
  '@libs/friends',
  '@libs/games',
  '@libs/notifications',
  '@libs/profile',
  '@libs/search',
  '@libs/spaces',
  '@libs/user-search',
]);

/** The one package allowed to know every feature. */
const COMPOSITION_ROOT = '@libs/runtime';

/** Packages that must stay composable from any subset of features. */
const SHELL = '@libs/client-app';

type Rule = {
  readonly pkg: string;
  readonly forbidden: ReadonlySet<string>;
  readonly why: string;
};

const RULES: readonly Rule[] = [
  {
    pkg: SHELL,
    forbidden: new Set([...FEATURES, COMPOSITION_ROOT]),
    why: "the app shell is what a feature's own e2e boots; naming a feature here puts every feature in every feature's build graph. Contribute routes, tabs, docks and providers through the FeatureClient fold instead, or declare a port the composition root fills.",
  },
  ...[...FEATURES, ...PLATFORM]
    .filter((pkg) => pkg !== '@libs/feature')
    .map((pkg) => ({
      pkg,
      forbidden: new Set([COMPOSITION_ROOT]),
      why: 'a feature must not import the composition root — that inverts the fold and drags every other feature in with it.',
    })),
  {
    pkg: '@libs/feature',
    forbidden: new Set([...FEATURES, COMPOSITION_ROOT, SHELL]),
    why: 'the manifest algebra is generic over what features declare; it may not know one.',
  },
];

function packageDir(pkg: string): string {
  return join(REPO_ROOT, pkg.replace('@libs/', 'libs/'));
}

function declaredDependencies(pkg: string): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(packageDir(pkg), 'package.json'), 'utf8')
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      sourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SPECIFIER =
  /from\s+'(@libs\/[a-z0-9-]+)(?:\/[^']*)?'|import\('(@libs\/[a-z0-9-]+)(?:\/[^']*)?'\)/g;

type Violation = {
  readonly pkg: string;
  readonly offender: string;
  /** Where it was found: the manifest, or a source file. */
  readonly at: string;
  readonly why: string;
};

function violationsFor(rule: Rule): Violation[] {
  const out: Violation[] = [];
  for (const dep of declaredDependencies(rule.pkg)) {
    if (rule.forbidden.has(dep)) {
      out.push({
        pkg: rule.pkg,
        offender: dep,
        at: `${relative(REPO_ROOT, packageDir(rule.pkg))}/package.json`,
        why: rule.why,
      });
    }
  }
  for (const file of sourceFiles(join(packageDir(rule.pkg), 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(SPECIFIER)) {
      const dep = match[1] ?? match[2];
      if (dep === undefined || !rule.forbidden.has(dep)) continue;
      out.push({
        pkg: rule.pkg,
        offender: dep,
        at: relative(REPO_ROOT, file),
        why: rule.why,
      });
    }
  }
  return out;
}

function main(): void {
  const violations = RULES.flatMap(violationsFor);
  if (violations.length > 0) {
    const lines = violations.map(
      (v) => `  ${v.at}\n    imports ${v.offender}\n    ${v.why}`
    );
    throw new Error(
      `package boundaries violated:\n${lines.join('\n\n')}\n\n` +
        'These decide what reruns: turbo builds its graph from package.json, so a\n' +
        'dependency here is a cache invalidation everywhere downstream.'
    );
  }
  console.log(
    `package boundaries hold across ${String(RULES.length)} packages`
  );
}

main();
