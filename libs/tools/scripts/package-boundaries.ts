// @io-wall-ok — package boundary rules, run by lint-package.ts (scripts/**).
/**
 * The boundaries that decide what reruns, and where code may run.
 *
 * Turbo builds its graph from `package.json` dependencies, so a package's
 * declared dependencies *are* its blast radius. If the app shell declares a
 * feature, every feature lands in every feature's test closure and
 * per-feature caching quietly stops working — the tests still pass, they just
 * all run, every time, and nobody notices for months. That is why this is a
 * gate and not a convention.
 *
 * Every package declares a `category` — where its source runs:
 *
 * | category     | name ends in | may depend on                      |
 * | ------------ | ------------ | ---------------------------------- |
 * | `isomorphic` | `-shared`    | isomorphic                         |
 * | `client`     | `-client`    | client, isomorphic                 |
 * | `server`     | `-server`    | server, isomorphic                 |
 * | `harness`    | `-harness`   | anything                           |
 *
 * Nothing but a harness depends on a harness. `devDependencies` (tests,
 * scripts, build config) may name any non-harness package. Isomorphic source
 * imports no client-only or server-only runtime module.
 *
 * The category is spelled in the package name, so a dependency's category is
 * read from its name and each rule reads only its own package — which is what
 * lets it run inside that package's cached `lint`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceImports } from './source-imports';

export const CATEGORIES = [
  'client',
  'server',
  'isomorphic',
  'harness',
] as const;
export type Category = (typeof CATEGORIES)[number];

const SUFFIX: Readonly<Record<string, Category>> = {
  client: 'client',
  server: 'server',
  shared: 'isomorphic',
  harness: 'harness',
};

const ALLOWED: Readonly<Record<Category, readonly Category[]>> = {
  isomorphic: ['isomorphic'],
  client: ['client', 'isomorphic'],
  server: ['server', 'isomorphic'],
  harness: ['harness', 'client', 'server', 'isomorphic'],
};

/** The category a workspace package name spells, or undefined. */
export function categoryOfName(name: string): Category | undefined {
  const last = name.split('/').pop() ?? '';
  const suffix = last.match(/(?:^|-)(client|server|shared|harness)$/)?.[1];
  return suffix === undefined ? undefined : SUFFIX[suffix];
}

/** Runtime modules isomorphic source may not load. Type-only imports are fine. */
const CLIENT_ONLY =
  /^(solid-js|@solidjs\/|@lingui\/solid|@tanstack\/solid|lucide-solid|prosemirror-|web-vitals|workbox-window|happy-dom|@happy-dom\/|@testing-library\/)/;
const SERVER_ONLY =
  /^(node:|bun$|bun:sqlite|pg$|better-sqlite3|hono|@hono\/|stripe$|@aws-sdk\/|embedded-postgres|aedes|ffmpeg-static|sharp$|onnxruntime-node|cloudflare:)/;

/**
 * Cross-cutting families every app needs whatever it was composed from:
 * identity, permission policy, runtime config and the shared test-id constants.
 */
const PLATFORM = ['auth', 'app-config', 'permissions', 'test-ids'] as const;

/** Bounded contexts. One of these in the shell's graph is the bug. */
const FEATURES = [
  'billing',
  'chess',
  'friends',
  'games',
  'notifications',
  'profile',
  'search',
  'spaces',
  'user-search',
] as const;

/** The one family allowed to know every feature. */
const COMPOSITION_ROOT = 'runtime';

/**
 * Families that must stay composable from any subset of features: the app
 * shell, and the harness a feature's own spec boots them through.
 */
const SHELLS = ['app', 'harness'] as const;

const FAMILIES = [
  ...PLATFORM,
  ...FEATURES,
  COMPOSITION_ROOT,
  ...SHELLS,
  'feature',
].sort((a, b) => b.length - a.length);

/** `@libs/chess-puzzle-client` -> `chess`; undefined outside `@libs/`. */
export function familyOf(name: string): string | undefined {
  if (!name.startsWith('@libs/')) return undefined;
  const rest = name.slice('@libs/'.length);
  return FAMILIES.find((f) => rest === f || rest.startsWith(`${f}-`));
}

type Rule = {
  readonly forbidden: ReadonlySet<string>;
  readonly why: string;
};

const SHELL_RULE: Rule = {
  forbidden: new Set([...FEATURES, COMPOSITION_ROOT]),
  why: "the shell is what a feature's own spec boots; naming a feature here puts every feature in every feature's build graph. Contribute through the FeatureClient / FeatureServer fold instead, or declare a port the composition root fills.",
};

const FEATURE_RULE: Rule = {
  forbidden: new Set([COMPOSITION_ROOT]),
  why: 'a feature must not import the composition root — that inverts the fold and drags every other feature in with it.',
};

const RULES: ReadonlyMap<string, Rule> = new Map([
  ...SHELLS.map((f) => [f, SHELL_RULE] as const),
  ...[...FEATURES, ...PLATFORM].map((f) => [f, FEATURE_RULE] as const),
  [
    'feature',
    {
      forbidden: new Set([...FEATURES, COMPOSITION_ROOT, ...SHELLS]),
      why: 'the manifest algebra is generic over what features declare; it may not know one, nor the shells that fold them.',
    },
  ],
]);

type Manifest = {
  readonly name?: string;
  readonly category?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
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

const WORKSPACE_SPECIFIER =
  /from\s+'(@(?:libs|pkgs)\/[a-z0-9-]+)(?:\/[^']*)?'|import\('(@(?:libs|pkgs)\/[a-z0-9-]+)(?:\/[^']*)?'\)/g;

/** Category rules for one manifest, given its source texts. Pure, for tests. */
export function categoryViolations(
  manifest: Manifest,
  options: {
    readonly tier: string;
    readonly hasSrc: boolean;
    readonly sources: readonly {
      readonly path: string;
      readonly text: string;
    }[];
  }
): readonly string[] {
  const out: string[] = [];
  const name = manifest.name ?? '';
  const category = manifest.category as Category | undefined;
  if (category === undefined || !CATEGORIES.includes(category)) {
    return [
      `package.json declares no category (one of ${CATEGORIES.join(', ')})`,
    ];
  }
  if (
    options.tier !== 'apps' &&
    options.hasSrc &&
    categoryOfName(name) !== category
  ) {
    out.push(
      `${name} is ${category}, so its name ends in -${category === 'isomorphic' ? 'shared' : category}`
    );
  }
  for (const field of ['dependencies', 'devDependencies'] as const) {
    for (const [dep, version] of Object.entries(manifest[field] ?? {})) {
      if (!version.startsWith('workspace:')) continue;
      // External workspaces keep their upstream naming and release policy.
      if (!/^@(apps|libs|pkgs)\//.test(dep)) continue;
      const depCategory = categoryOfName(dep);
      if (depCategory === undefined) {
        out.push(`${field} names ${dep}, whose name spells no category`);
        continue;
      }
      if (depCategory === 'harness' && category !== 'harness') {
        out.push(
          `${field} names harness ${dep}: only a harness depends on a harness`
        );
        continue;
      }
      if (
        field === 'dependencies' &&
        !ALLOWED[category].includes(depCategory)
      ) {
        out.push(`${category} package depends on ${depCategory} ${dep}`);
      }
    }
  }
  for (const file of options.sources) {
    if (file.path.startsWith('src/') && file.path.slice(4).includes('/'))
      out.push(
        `${file.path}: src must be flat; split a vertical slice into its own package`
      );
    for (const reference of sourceImports(file.text)) {
      const spec = reference.specifier;
      const dep = /^(@(?:apps|libs|pkgs)\/[^/]+)/.exec(spec)?.[1];
      const depCategory = dep === undefined ? undefined : categoryOfName(dep);
      if (depCategory !== undefined && !ALLOWED[category].includes(depCategory))
        out.push(
          `${file.path}: ${category} source imports ${depCategory} ${dep}`
        );
      if (
        category === 'isomorphic' &&
        !reference.typeOnly &&
        (CLIENT_ONLY.test(spec) || SERVER_ONLY.test(spec))
      )
        out.push(`${file.path} loads ${spec}, which does not run everywhere`);
    }
  }
  return out;
}

/**
 * Every boundary the package at `pkgDir` breaks, as printable lines. Empty for
 * a package that keeps them all.
 */
export function packageBoundaryViolations(pkgDir: string): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(pkgDir, 'package.json'), 'utf8')
  ) as Manifest;
  const srcDir = join(pkgDir, 'src');
  const sources = sourceFiles(srcDir).filter((f) => !/\.test\.tsx?$/.test(f));
  const out: string[] = [
    ...categoryViolations(manifest, {
      tier: pkgDir.split('/').at(-2) ?? '',
      hasSrc: existsSync(srcDir),
      sources: sources.map((path) => ({
        path: path.slice(pkgDir.length + 1),
        text: readFileSync(path, 'utf8'),
      })),
    }),
  ];
  const family = familyOf(manifest.name ?? '');
  const rule = family === undefined ? undefined : RULES.get(family);
  if (rule === undefined) return out;
  const familyOfDep = (dep: string) => familyOf(dep) ?? '';
  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
  const broken: string[] = [];
  for (const dep of declared) {
    if (rule.forbidden.has(familyOfDep(dep)))
      broken.push(`package.json declares ${dep}`);
  }
  for (const file of sources) {
    for (const match of readFileSync(file, 'utf8').matchAll(
      WORKSPACE_SPECIFIER
    )) {
      const dep = match[1] ?? match[2];
      if (dep !== undefined && rule.forbidden.has(familyOfDep(dep))) {
        broken.push(`${file.slice(pkgDir.length + 1)} imports ${dep}`);
      }
    }
  }
  return broken.length === 0 ? out : [...out, ...broken, `  why: ${rule.why}`];
}
