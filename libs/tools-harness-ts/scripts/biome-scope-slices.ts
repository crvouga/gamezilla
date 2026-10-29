#!/usr/bin/env bun
// @io-wall-ok — derives the shared Biome config and each package's scope slice (`biome-scope-slices`).
/**
 * Which part of `biome.json` can change one package's `lint`.
 *
 * `biome.json` is one file, and a `lint` task that lists it as an input reruns
 * in every package whenever any line changes. Most of its lines are scope
 * lists: about three quarters of the `includes` entries of its plugins name
 * one package's directory (`**\/pkgs/<name>/src/**`), and a line for package
 * A cannot change what Biome reports about package B. Adding a package, or
 * putting one under a rule, was nonetheless a full miss of the lint corpus.
 *
 * `biome.json` stays the one file people edit and the one Biome reads. This
 * module derives two things from it, committed so Turborepo can hash them:
 *
 * - `biome.shared.json`: `biome.json` without those per-package entries. Every
 *   package's `lint` lists it, so a rule, a plugin or a repository-wide scope
 *   still reruns lint everywhere.
 * - `<package>/biome-scope.json`: the entries that name that package, verbatim
 *   and in place. It is one of the package's own files, so only that package's
 *   `lint` sees an edit to it.
 *
 * `bun run libs/tools-harness-ts/scripts/biome-scope-slices.ts` rewrites them
 * after an edit to `biome.json`; `biome-scope-slices.test.ts` fails on drift.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

type Json = unknown;
type BiomeConfig = {
  files?: { includes?: string[] };
  overrides?: { includes?: string[] }[];
  plugins?: (string | { path: string; includes?: string[] })[];
  [key: string]: Json;
};

/** Where the entries of one `includes` list sit in `biome.json`. */
export type Slice = Record<string, string[]>;

const ROOT = join(import.meta.dirname, '../../..');
const TIERS = ['apps', 'libs', 'pkgs'] as const;
export const SLICE_FILE = 'biome-scope.json';
export const SHARED_FILE = 'biome.shared.json';

const OWNER = /^!{0,2}(?:\*\*\/)?((?:apps|libs|pkgs)\/[a-z0-9-]+)\//;

/** The `includes` lists of a config, keyed by a stable name. */
function includeLists(config: BiomeConfig): Map<string, string[]> {
  const lists = new Map<string, string[]>();
  if (config.files?.includes) lists.set('files', config.files.includes);
  config.overrides?.forEach((override, index) => {
    if (override.includes) lists.set(`overrides[${index}]`, override.includes);
  });
  const seen = new Map<string, number>();
  for (const plugin of config.plugins ?? []) {
    if (typeof plugin === 'string' || plugin.includes === undefined) continue;
    const count = seen.get(plugin.path) ?? 0;
    seen.set(plugin.path, count + 1);
    lists.set(
      count === 0 ? `plugin:${plugin.path}` : `plugin:${plugin.path}#${count}`,
      plugin.includes
    );
  }
  return lists;
}

export function splitBiomeConfig(
  config: BiomeConfig,
  workspaceDirs: ReadonlySet<string>
): { shared: BiomeConfig; slices: Map<string, Slice> } {
  const shared = structuredClone(config);
  const slices = new Map<string, Slice>();
  const lists = includeLists(shared);
  for (const [key, list] of lists) {
    const kept: string[] = [];
    for (const entry of list) {
      const owner = OWNER.exec(entry)?.[1];
      if (owner === undefined || !workspaceDirs.has(owner)) {
        kept.push(entry);
        continue;
      }
      const slice = slices.get(owner) ?? {};
      (slice[key] ??= []).push(entry);
      slices.set(owner, slice);
    }
    list.splice(0, list.length, ...kept);
  }
  return { shared, slices };
}

/** The reverse: every entry in the lists of `biome.json`, sorted per list. */
export function mergedLists(
  shared: BiomeConfig,
  slices: ReadonlyMap<string, Slice>
): Map<string, string[]> {
  const merged = new Map<string, string[]>(
    [...includeLists(structuredClone(shared))].map(([key, list]) => [
      key,
      [...list],
    ])
  );
  for (const slice of slices.values())
    for (const [key, entries] of Object.entries(slice))
      merged.get(key)?.push(...entries);
  for (const list of merged.values()) list.sort();
  return merged;
}

export function sortedLists(config: BiomeConfig): Map<string, string[]> {
  return new Map(
    [...includeLists(config)].map(([key, list]) => [key, [...list].sort()])
  );
}

function workspaceDirectories(): Set<string> {
  const dirs = new Set<string>();
  for (const tier of TIERS)
    for (const entry of readdirSync(join(ROOT, tier)))
      if (existsSync(join(ROOT, tier, entry, 'package.json')))
        dirs.add(`${tier}/${entry}`);
  return dirs;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export type Derived = {
  readonly shared: BiomeConfig;
  readonly slices: Map<string, Slice>;
  readonly dirs: ReadonlySet<string>;
};

export function deriveFromBiomeJson(): Derived {
  const dirs = workspaceDirectories();
  return {
    ...splitBiomeConfig(
      readJson(join(ROOT, 'biome.json')) as BiomeConfig,
      dirs
    ),
    dirs,
  };
}

/** Files that differ from what `biome.json` derives, as repo-relative paths. */
export function sliceDrift(derived: Derived = deriveFromBiomeJson()): string[] {
  const drift: string[] = [];
  const same = (path: string, expected: unknown): boolean =>
    existsSync(path) &&
    JSON.stringify(readJson(path)) === JSON.stringify(expected);
  if (!same(join(ROOT, SHARED_FILE), derived.shared)) drift.push(SHARED_FILE);
  for (const dir of derived.dirs) {
    const slice = derived.slices.get(dir);
    const path = join(ROOT, dir, SLICE_FILE);
    if (slice === undefined ? existsSync(path) : !same(path, slice))
      drift.push(`${dir}/${SLICE_FILE}`);
  }
  return drift;
}

/** Rewrite `biome.shared.json` and every slice that has drifted; how many. */
export function syncBiomeSlices(): number {
  const derived = deriveFromBiomeJson();
  const drift = sliceDrift(derived);
  const written: string[] = [];
  for (const file of drift) {
    const path = join(ROOT, file);
    const dir =
      file === SHARED_FILE ? undefined : file.slice(0, -SLICE_FILE.length - 1);
    const content =
      dir === undefined ? derived.shared : derived.slices.get(dir);
    if (content === undefined) rmSync(path, { force: true });
    else {
      writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
      written.push(path);
    }
  }
  if (written.length > 0)
    spawnSync(
      join(ROOT, 'node_modules/.bin/biome'),
      ['format', '--write', ...written],
      { cwd: ROOT, stdio: 'ignore' }
    );
  return drift.length;
}

if (import.meta.main) {
  console.log(`biome scope slices: ${syncBiomeSlices()} files rewritten`);
}
