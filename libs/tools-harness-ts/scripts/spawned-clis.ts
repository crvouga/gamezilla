// @io-wall-ok — lint rule over a package's own files, run by lint-package.ts (scripts/**).
/**
 * A package that spawns an npm-provided CLI declares the package that ships it.
 *
 * `bun run` puts only the running package's own `node_modules/.bin` (and its
 * ancestors') on `PATH`, and the isolated linker links a bin only into the
 * packages that declare it. So a script that spawns `wrangler` from a package
 * that does not declare `wrangler` works on a laptop with a global install and
 * dies on CI with `Executable not found in $PATH: "wrangler"` — which is how
 * the product deploy broke once the global CLI installer was replaced by mise.
 *
 * "Spawns" is textual: the bin name as a string literal right after `(` or `[`,
 * the first argument of `spawn` / `runAsync` / `runSafe` / an argv array.
 */

/** Bin name → the npm package that provides it. */
const NPM_CLIS: Readonly<Record<string, string>> = {
  wrangler: 'wrangler',
};

type Manifest = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

export function spawnedCliViolations(input: {
  readonly manifest: Manifest;
  /** Package-relative path → source text. */
  readonly sources: ReadonlyArray<{ path: string; text: string }>;
}): readonly string[] {
  const declared = new Set([
    ...Object.keys(input.manifest.dependencies ?? {}),
    ...Object.keys(input.manifest.devDependencies ?? {}),
  ]);
  const errors: string[] = [];
  for (const [bin, pkg] of Object.entries(NPM_CLIS)) {
    if (declared.has(pkg)) continue;
    const spawn = new RegExp(`[([]\\s*['"\`]${bin}['"\`]`);
    for (const source of input.sources) {
      if (spawn.test(source.text)) {
        errors.push(
          `${source.path} spawns \`${bin}\` but package.json does not declare "${pkg}" (add "${pkg}": "catalog:" to devDependencies)`
        );
      }
    }
  }
  return errors;
}
