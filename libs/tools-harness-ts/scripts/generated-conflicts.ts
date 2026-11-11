/**
 * Merge conflicts in files a tool writes are never resolved by hand: the
 * tool rebuilds them from the merged sources. `git-sync` uses this plan when
 * merging `origin/main` conflicts only in such files.
 *
 * Each rule says how the conflicted file is first settled (take trunk's copy,
 * or drop it from the index when it is no longer committed) and which command
 * rebuilds it once every other file has merged cleanly.
 */

export type GeneratedRule = {
  readonly name: string;
  readonly matches: (path: string) => boolean;
  /** `theirs`: start from trunk's copy. `untrack`: the file is no longer committed. */
  readonly settle: 'theirs' | 'untrack';
  /** Rebuilds the file from the merged sources; `null` when settling is enough. */
  readonly rebuild: readonly string[] | null;
};

export const GENERATED_RULES: readonly GeneratedRule[] = [
  {
    // `bun install` rewrites the lockfile from the merged package.json files.
    name: 'bun.lock',
    matches: (path) => path === 'bun.lock',
    settle: 'theirs',
    rebuild: ['bun', 'install'],
  },
  {
    // Extracted from the source macros by `bun run i18n:compile`; gitignored.
    name: 'Lingui catalog',
    matches: (path) =>
      /^libs\/app-root-shared-ts\/locales\/[^/]+\/messages\.po$/u.test(path),
    settle: 'untrack',
    rebuild: ['bun', 'run', 'i18n:compile'],
  },
  {
    // Derived from biome.json by `bun run cache:sync`.
    name: 'Biome scope slices',
    matches: (path) =>
      path === 'biome.shared.json' || path.endsWith('/biome-scope.json'),
    settle: 'theirs',
    rebuild: ['bun', 'run', 'cache:sync'],
  },
];

export type GeneratedPlan = {
  /** Conflicted paths a rule owns, with the rule that owns each. */
  readonly generated: readonly {
    readonly path: string;
    readonly rule: GeneratedRule;
  }[];
  /** Conflicted paths a person (or agent) has to resolve. */
  readonly manual: readonly string[];
  /** Rebuild commands to run once, in rule order. */
  readonly rebuilds: readonly (readonly string[])[];
};

export function planGeneratedConflicts(
  conflicted: readonly string[],
  rules: readonly GeneratedRule[] = GENERATED_RULES
): GeneratedPlan {
  const generated: { path: string; rule: GeneratedRule }[] = [];
  const manual: string[] = [];
  for (const path of conflicted) {
    const rule = rules.find((candidate) => candidate.matches(path));
    if (rule) generated.push({ path, rule });
    else manual.push(path);
  }
  const rebuilds = rules
    .filter((rule) => rule.rebuild !== null)
    .filter((rule) => generated.some((entry) => entry.rule === rule))
    .map((rule) => rule.rebuild as readonly string[]);
  return { generated, manual, rebuilds };
}

/** The git command that settles one generated file before it is rebuilt. */
export function settleCommand(path: string, rule: GeneratedRule): string[] {
  return rule.settle === 'theirs'
    ? ['git', 'checkout', '--theirs', '--', path]
    : ['git', 'rm', '--cached', '--quiet', '--', path];
}

/**
 * How to finish the generated files by hand. With `settled`, they already
 * hold trunk's copy (or left the index) and only need rebuilding.
 */
export function generatedConflictHint(
  plan: GeneratedPlan,
  settled = false
): string {
  if (plan.generated.length === 0) return '';
  const settle = settled
    ? []
    : plan.generated.map(({ path, rule }) =>
        settleCommand(path, rule).join(' ')
      );
  const rebuild = plan.rebuilds.map((command) => command.join(' '));
  const files = plan.generated.map(({ path }) => path).join(', ');
  return [
    settled
      ? `Generated files were settled to trunk's copy, not merged: ${files}.`
      : `These conflicted files are generated; do not merge them by hand: ${files}.`,
    'After resolving the rest, and before committing the merge, run:',
    ...[...settle, ...rebuild].map((line) => `  ${line}`),
    'then `git add` what they changed.',
  ].join('\n');
}
