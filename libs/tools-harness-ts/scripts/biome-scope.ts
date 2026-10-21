/**
 * Scope Biome's project scan to one package and the workspace packages it
 * depends on.
 *
 * `noFloatingPromises`, `noMisusedPromises`, `noImportCycles` and
 * `noUndeclaredDependencies` make Biome index the whole project before it
 * lints a single file — about 5 s of CPU per call on this repo, paid once per
 * package `lint`. A package can only see the packages it declares (the
 * package-boundary rules enforce that), so the scan only needs those; every
 * other package is force-ignored (`!!`), which keeps it out of the scan.
 *
 * The scoped config is the root `biome.json` plus those force-ignores, so the
 * rules are the same; it must sit in the repo root because Biome resolves the
 * project root, `files.includes` and the plugin paths from the config's
 * directory.
 */

export type WorkspacePackage = {
  /** Repo-relative directory, e.g. `pkgs/assert`. */
  readonly dir: string;
  /** Workspace packages it declares in `dependencies` or `devDependencies`. */
  readonly deps: readonly string[];
};

/** `dir` plus every workspace package it reaches through declared deps. */
export function dependencyClosure(
  packages: ReadonlyMap<string, WorkspacePackage>,
  dir: string
): ReadonlySet<string> {
  const byDir = new Map([...packages.values()].map((p) => [p.dir, p]));
  const seen = new Set<string>([dir]);
  const queue = [...(byDir.get(dir)?.deps ?? [])];
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    const pkg = packages.get(name);
    if (pkg === undefined || seen.has(pkg.dir)) continue;
    seen.add(pkg.dir);
    queue.push(...pkg.deps);
  }
  return seen;
}

type BiomeConfig = {
  readonly files?: { readonly includes?: readonly string[] };
  readonly [key: string]: unknown;
};

/** The root config with every package outside `keep` force-ignored. */
export function scopedBiomeConfig(
  root: BiomeConfig,
  allDirs: readonly string[],
  keep: ReadonlySet<string>
): BiomeConfig {
  const ignored = allDirs
    .filter((dir) => !keep.has(dir))
    .sort()
    .map((dir) => `!!${dir}`);
  return {
    ...root,
    files: {
      ...root.files,
      includes: [...(root.files?.includes ?? ['**']), ...ignored],
    },
  };
}

/** Workspace dependency names declared in a `package.json`. */
export function workspaceDeps(manifest: {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}): readonly string[] {
  return Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name);
}
