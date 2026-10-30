// @io-wall-ok — package boundary rules, run by lint-package.ts (scripts/**).
/**
 * The boundaries that decide what reruns, and where code may run.
 *
 * Turbo builds its graph from `package.json` dependencies, so a package's
 * declared dependencies *are* its blast radius. If the app shell declares a
 * sub, every sub lands in every sub's test closure and
 * per-sub caching quietly stops working — the tests still pass, they just
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
 * The category is spelled in the package name (held by `package-names.ts`,
 * the `ci:package-names` gate), so a dependency's category is read from its
 * name and each rule reads only its own package — which is what lets it run
 * inside that package's cached `lint`.
 *
 * Every package also declares its `language` (`languages.ts`). A production dependency
 * stays inside one language or reaches a language-neutral package; the
 * native manifests (`Package.swift`, the Xcode project) name exactly the
 * workspace packages `package.json` does, so Turborepo's graph and the
 * native one never disagree.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import ts from 'typescript';
import {
  languageViolations,
  nativeGraphViolations,
  nativeSourceViolations,
} from './language-boundaries';
import { CATEGORIES, type Category, categoryOfName } from './package-names';
import { sourceImports } from './source-imports';

const ALLOWED: Readonly<Record<Category, readonly Category[]>> = {
  isomorphic: ['isomorphic'],
  client: ['client', 'isomorphic'],
  server: ['server', 'isomorphic'],
  harness: ['harness', 'client', 'server', 'isomorphic'],
};

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

/** Product subs. One of these in the shell's graph is the bug. */
const SUBS = [
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

/** The one family allowed to know every sub. */
const COMPOSITION_ROOT = 'runtime';

/**
 * Families that must stay composable from any subset of subs: the app
 * shell, and the harness a sub's own spec boots them through.
 */
const SHELLS = ['app', 'harness'] as const;

const FAMILIES = [
  ...PLATFORM,
  ...SUBS,
  COMPOSITION_ROOT,
  ...SHELLS,
  'sub',
].sort((a, b) => b.length - a.length);

/** `@libs/chess-puzzle-client-ts` -> `chess`; undefined outside `@libs/`. */
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
  forbidden: new Set([...SUBS, COMPOSITION_ROOT]),
  why: "the shell is what a sub's own spec boots; naming a sub here puts every sub in every sub's build graph. Contribute through the SubClient / SubServer fold instead, or declare a port the composition root fills.",
};

const SUB_RULE: Rule = {
  forbidden: new Set([COMPOSITION_ROOT]),
  why: 'a sub must not import the composition root — that inverts the fold and drags every other sub in with it.',
};

const RULES: ReadonlyMap<string, Rule> = new Map([
  ...SHELLS.map((f) => [f, SHELL_RULE] as const),
  ...[...SUBS, ...PLATFORM].map((f) => [f, SUB_RULE] as const),
  [
    'sub',
    {
      forbidden: new Set([...SUBS, COMPOSITION_ROOT, ...SHELLS]),
      why: 'the manifest algebra is generic over what subs declare; it may not know a product sub, nor the shells that fold them.',
    },
  ],
]);

/** Whether `family` may depend on `dependency`, from the shipped rules. */
export function familyMayDependOn(family: string, dependency: string): boolean {
  const rule = RULES.get(family);
  if (rule === undefined) return true;
  return !rule.forbidden.has(dependency);
}

type Manifest = {
  readonly name?: string;
  readonly category?: string;
  /** `languages.ts`: the implementation language, or `neutral`. */
  readonly language?: string;
  /** `package-hosts.ts`: what the package builds for. */
  readonly platforms?: unknown;
  /** The one game this package implements (`chess`, `connect-four`, …). */
  readonly game?: string;
  /** This package composes concrete games: a game registry or composition root. */
  readonly gameRegistry?: boolean;
  /**
   * A game framework package's public modules: the `src/<module>` files a
   * game package may import. Every other module is the framework's own
   * implementation.
   */
  readonly gameApi?: readonly string[];
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
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(slashPath(full));
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
    readonly sources: readonly {
      readonly path: string;
      readonly text: string;
    }[];
  }
): readonly string[] {
  const out: string[] = [];
  const category = manifest.category as Category | undefined;
  if (category === undefined || !CATEGORIES.includes(category)) {
    return [
      `package.json declares no category (one of ${CATEGORIES.join(', ')})`,
    ];
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
  const componentSlices = new Set(
    options.sources
      .filter((file) => /^src\/[^/]+\/index\.tsx$/.test(file.path))
      .map((file) => file.path.split('/')[1])
  );
  for (const file of options.sources) {
    const componentSlice =
      category === 'client' &&
      options.tier === 'pkgs' &&
      /^src\/[^/]+\/[^/]+$/.test(file.path) &&
      componentSlices.has(file.path.split('/')[1]);
    if (
      file.path.startsWith('src/') &&
      file.path.slice(4).includes('/') &&
      !componentSlice
    )
      out.push(
        `${file.path}: src must be flat; split a vertical slice into its own package`
      );
    for (const reference of sourceImports(file.text)) {
      const spec = reference.specifier;
      const dep = /^(@(?:apps|libs|pkgs)\/[^/]+)/.exec(spec)?.[1];
      const depCategory = dep === undefined ? undefined : categoryOfName(dep);
      // Hono RPC clients infer contracts from server routes through erased imports.
      const rpcType =
        reference.typeOnly && category === 'client' && depCategory === 'server';
      if (
        depCategory !== undefined &&
        !ALLOWED[category].includes(depCategory) &&
        !rpcType
      )
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
 * Games are isolated by construction. A game package (`"game": "<id>"`)
 * depends on no other game; a package that is not a game depends on a game
 * only when it declares itself a game registry (`"gameRegistry": true`) — the
 * few composition roots that list every game. A registry composes every
 * game, so depending on one makes a package a registry too, and a game is
 * never one: no game reaches its siblings through a registry. A package
 * named for a game (`@libs/<id>-…`) declares that game, so a new package
 * cannot slip past.
 */
export function gameViolations(
  manifest: Manifest,
  workspace: ReadonlyMap<string, Manifest>
): readonly string[] {
  const name = manifest.name ?? '';
  const games = new Set(
    [...workspace.values()].flatMap((other) =>
      other.game === undefined ? [] : [other.game]
    )
  );
  const out: string[] = [];
  for (const game of games)
    if (
      (name.startsWith(`@libs/${game}-`) ||
        name.startsWith(`@pkgs/${game}-`)) &&
      manifest.game !== game
    )
      out.push(
        `${name} is named for the game ${game}; declare "game": "${game}"`
      );
  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
  if (manifest.game !== undefined && manifest.gameRegistry === true)
    out.push(
      `${name} is a game of ${manifest.game} and a game registry: a game never composes the others`
    );
  for (const dep of declared) {
    if (workspace.get(dep)?.gameRegistry === true) {
      if (manifest.game !== undefined)
        out.push(
          `game ${manifest.game} depends on ${dep}, a game registry: through it the game would know every other game; take its own rules from its own packages`
        );
      else if (manifest.gameRegistry !== true)
        out.push(
          `${dep} composes every game: a package depending on it composes games too; declare "gameRegistry": true, or receive the games through ports`
        );
    }
    const game = workspace.get(dep)?.game;
    if (game === undefined || game === manifest.game) continue;
    if (manifest.game !== undefined)
      out.push(
        `game ${manifest.game} depends on ${dep} of game ${game}: games never know each other; a game registry composes them`
      );
    else if (manifest.gameRegistry !== true)
      out.push(
        `${dep} implements the game ${game}: only a game registry ("gameRegistry": true) composes concrete games; receive the game through the registry's ports`
      );
  }
  return out;
}

/**
 * A game depends on what the framework promises, never on how it is built.
 * A framework package declares its public modules (`"gameApi"`); a game
 * package — its source, tests and steps alike — imports only those from it.
 * Framework packages keep using each other's modules freely; the list
 * binds games alone. A framework package lists only modules it has, and is
 * never a game itself.
 */
export function gameApiViolations(
  manifest: Manifest,
  options: {
    readonly workspace: ReadonlyMap<string, Manifest>;
    readonly modules: ReadonlySet<string>;
    readonly sources: readonly {
      readonly path: string;
      readonly text: string;
    }[];
  }
): readonly string[] {
  const name = manifest.name ?? '';
  const out: string[] = [];
  if (manifest.gameApi !== undefined) {
    if (manifest.gameRegistry === true && manifest.gameApi.length > 0)
      out.push(
        `${name} offers a game API and composes concrete games: framework contracts must receive games through ports, never a registry`
      );
    if (manifest.game !== undefined)
      out.push(
        `${name} is a game of ${manifest.game} and declares a game API: only framework packages offer one`
      );
    for (const module of manifest.gameApi)
      if (!options.modules.has(module))
        out.push(
          `gameApi lists "${module}", which ${name} does not have (src/${module}.ts): list only modules a game may import`
        );
  }
  if (manifest.game === undefined) return out;
  for (const file of options.sources)
    for (const reference of sourceImports(file.text)) {
      const match = /^(@(?:libs|pkgs)\/[^/]+)\/(.+)$/.exec(reference.specifier);
      if (match === null) continue;
      const [, dependency = '', module = ''] = match;
      const api = options.workspace.get(dependency)?.gameApi;
      if (api === undefined || api.includes(module)) continue;
      out.push(
        `${file.path}: imports ${reference.specifier}, which is ${dependency}'s own implementation, not its game API (${api.length === 0 ? 'it offers games none' : api.join(', ')}). A game depends on what the framework promises: use a public module, add a focused read, action or fixture helper to one, or move a test of the framework's own behaviour into the framework`
      );
    }
  return out;
}

/** A game's id in a platform package's own source: the line marks a durable name. */
const DURABLE_NAME = '@durable-name';

/**
 * Platform source never spells a game: outside a game's own packages and
 * the registries, no string literal equals a registered game id, so no
 * shared code can branch on, route to or special-case one game. A durable
 * stored name that predates the platform is declared once, on a line marked
 * `@durable-name`. Comments are not code and do not count.
 */
export function gameIdentityViolations(
  manifest: Manifest,
  options: {
    readonly gameIds: ReadonlySet<string>;
    readonly sources: readonly {
      readonly path: string;
      readonly text: string;
    }[];
  }
): readonly string[] {
  if (manifest.game !== undefined || manifest.gameRegistry === true) return [];
  const out: string[] = [];
  for (const file of options.sources) {
    const lines = file.text.split('\n');
    for (const literal of stringLiterals(file.text)) {
      if (!options.gameIds.has(literal.text)) continue;
      if (lines[literal.line]?.includes(DURABLE_NAME)) continue;
      out.push(
        `${file.path}:${String(literal.line + 1)} spells the game '${literal.text}': platform code receives games through the registry's ports and never names one`
      );
    }
  }
  return out;
}

function stringLiterals(
  text: string
): readonly { readonly text: string; readonly line: number }[] {
  const file = ts.createSourceFile(
    'source.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const out: { text: string; line: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node))
      out.push({
        text: node.text,
        line: file.getLineAndCharacterOfPosition(node.getStart(file)).line,
      });
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** Every workspace manifest by name, and each package's name by directory. */
function workspaceManifests(pkgDir: string): {
  readonly byName: ReadonlyMap<string, Manifest>;
  readonly byDir: ReadonlyMap<string, string>;
} {
  const root = join(pkgDir, '..', '..');
  const byName = new Map<string, Manifest>();
  const byDir = new Map<string, string>();
  for (const tier of ['apps', 'libs', 'pkgs']) {
    const dir = join(root, tier);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const file = join(dir, entry, 'package.json');
      if (!existsSync(file)) continue;
      const other = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
      if (other.name === undefined) continue;
      byName.set(other.name, other);
      byDir.set(`${tier}/${entry}`, other.name);
    }
  }
  return { byName, byDir };
}

/** Build output and editor state, never a package's own files. */
const NOT_OWNED = new Set([
  'node_modules',
  '.cache',
  '.turbo',
  '.build',
  'xcuserdata',
]);

function packageFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    if (NOT_OWNED.has(entry.name)) continue;
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...packageFiles(dir, path));
    else out.push(path);
  }
  return out;
}

function languageAndNativeViolations(
  pkgDir: string,
  manifest: Manifest,
  workspace: ReturnType<typeof workspaceManifests>
): readonly string[] {
  const tier = slashPath(pkgDir).split('/').at(-2) ?? '';
  const native = {
    dir: `${tier}/${slashPath(pkgDir).split('/').at(-1) ?? ''}`,
    files: manifest.language === 'typescript' ? [] : packageFiles(pkgDir),
    read: (path: string) => readFileSync(join(pkgDir, path), 'utf8'),
    packagesByDir: workspace.byDir,
  };
  return [
    ...languageViolations(manifest, { tier, workspace: workspace.byName }),
    ...nativeGraphViolations(manifest, native),
    ...nativeSourceViolations(manifest, native),
  ];
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
  const manifests = workspaceManifests(pkgDir);
  const workspace = manifests.byName;
  const sources = sourceFiles(srcDir).filter((f) => !/\.test\.tsx?$/.test(f));
  const out: string[] = [
    ...categoryViolations(manifest, {
      tier: slashPath(pkgDir).split('/').at(-2) ?? '',
      sources: sources.map((path) => ({
        path: path.slice(pkgDir.length + 1),
        text: readFileSync(path, 'utf8'),
      })),
    }),
    ...languageAndNativeViolations(pkgDir, manifest, manifests),
    ...gameViolations(manifest, workspace),
    ...gameApiViolations(manifest, {
      workspace,
      modules: new Set(
        sourceFiles(srcDir).map((path) =>
          path.slice(srcDir.length + 1).replace(/\.(ts|tsx)$/, '')
        )
      ),
      sources: ['src', 'tests', 'scripts']
        .flatMap((dir) => sourceFiles(join(pkgDir, dir)))
        .map((path) => ({
          path: path.slice(pkgDir.length + 1),
          text: readFileSync(path, 'utf8'),
        })),
    }),
    ...(slashPath(pkgDir).split('/').at(-2) === 'libs'
      ? gameIdentityViolations(manifest, {
          gameIds: new Set(
            [...workspace.values()].flatMap((other) =>
              other.game === undefined ? [] : [other.game]
            )
          ),
          sources: [
            ...sourceFiles(srcDir),
            ...sourceFiles(join(pkgDir, 'tests')),
          ].map((path) => ({
            path: path.slice(pkgDir.length + 1),
            text: readFileSync(path, 'utf8'),
          })),
        })
      : []),
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
