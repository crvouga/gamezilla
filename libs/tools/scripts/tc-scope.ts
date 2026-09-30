/**
 * Every TypeScript file a package tracks is type-checked by that package's
 * `tc`, run by lint-package.ts.
 *
 * `bun test` strips types without checking them, so a test, fixture or script
 * outside the `tc` tsconfig's `include` can hold any type error and still pass
 * the gate. So can a package with no `tc` script at all — turbo schedules
 * nothing for it and says nothing.
 *
 * Pure over the manifest, the tsconfig text and the package's tracked files,
 * so it runs inside the package's cached `lint`.
 */

const TS_FILE = /\.(ts|tsx|mts|cts)$/;

/** `tc` must name its project: `tsc … -p <config>`. */
const TC_PROJECT = /\btsc\b.*\s-p\s+(\S+)/;

type TsConfig = {
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
};

/** tsconfig is JSONC: drop comments and trailing commas before parsing. */
export function parseTsConfig(text: string): TsConfig {
  const withoutComments = text.replace(
    /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_match, string: string | undefined) => string ?? ''
  );
  return JSON.parse(withoutComments.replace(/,(\s*[}\]])/g, '$1')) as TsConfig;
}

/** tsconfig include semantics: a pattern with no wildcard or extension is a directory. */
function toGlob(pattern: string): string {
  const path = pattern.replace(/^\.\//, '').replace(/\/$/, '');
  const last = path.split('/').pop() ?? '';
  return path.includes('*') || last.includes('.') ? path : `${path}/**/*`;
}

/** The tsconfig path the `tc` script checks, relative to the package. */
export function tcProject(tcScript: string | undefined): string | null {
  const match = tcScript === undefined ? null : TC_PROJECT.exec(tcScript);
  return match?.[1]?.replace(/^\.\//, '') ?? null;
}

/**
 * Every rule the package breaks, given its `tc` script, the text of the
 * tsconfig that script names (`null` if missing), and its tracked files
 * relative to the package root.
 */
export function tcScopeViolations(input: {
  readonly tcScript: string | undefined;
  readonly tsconfigText: string | null;
  readonly files: readonly string[];
}): readonly string[] {
  const sources = input.files.filter(
    (file) =>
      TS_FILE.test(file) &&
      !file.endsWith('.d.ts') &&
      !file.startsWith('node_modules/') &&
      !file.startsWith('dist/')
  );
  if (sources.length === 0) return [];
  const project = tcProject(input.tcScript);
  if (project === null) {
    return [
      `has TypeScript files but no \`tc\` script of the form \`tsc --noEmit … -p <tsconfig>\` — nothing type-checks them`,
    ];
  }
  if (input.tsconfigText === null) {
    return [`\`tc\` checks ${project}, which does not exist`];
  }
  const config = parseTsConfig(input.tsconfigText);
  const include = (config.include ?? ['**/*']).map(
    (pattern) => new Bun.Glob(toGlob(pattern))
  );
  const exclude = (config.exclude ?? []).map(
    (pattern) => new Bun.Glob(toGlob(pattern))
  );
  const unchecked = sources.filter(
    (file) =>
      !include.some((glob) => glob.match(file)) ||
      exclude.some((glob) => glob.match(file))
  );
  if (unchecked.length === 0) return [];
  return [
    `files outside ${project}'s include — \`bun test\` strips their types unchecked; include them:\n    ${unchecked.join('\n    ')}`,
  ];
}
