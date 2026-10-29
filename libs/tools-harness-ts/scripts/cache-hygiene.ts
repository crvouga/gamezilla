/**
 * The rules that keep Turborepo's task cache effective. Pure, no I/O;
 * `verify-cache-hygiene.ts` is the gate
 * (`@libs/tools-harness-ts#ci:cache-hygiene`) and reads `cache-hygiene.json`.
 *
 * A cache hit needs the inputs of a task to be unchanged. Four structures
 * make an edit miss far more tasks than it should, and each has a rule:
 *
 * - **A hub** reruns the tasks of many packages whenever any of its files
 *   changes (`hub-new`, `hub-growth`, `hub-size`, `hub-cohesion`).
 * - **A broad input glob** (`$TURBO_ROOT$/libs/*\/package.json`) reruns a task
 *   on an edit to any package in the workspace (`broad-input`).
 * - **A global input** reruns every task of every package
 *   (`global-dependency`, `global-alias`).
 * - **A derived file out of date** (`derived`): the `src` edges and the Biome
 *   slices only narrow what an edit reruns while they match what they are
 *   derived from.
 *
 * Every message says what is wrong, why it costs cache hits, and what to do.
 */
import type { Blast, GraphPackage } from './cache-graph';

export type Limits = {
  /** A package whose edits rerun this many packages is a hub. */
  readonly hubBlast: number;
  /** ...and one that reruns this many is a large hub. */
  readonly largeHubBlast: number;
  readonly maxFilesAtHub: number;
  readonly maxFilesAtLargeHub: number;
  /** Cohesion: files that reach few packages, in a package that reaches many. */
  readonly cohesion: {
    readonly minFiles: number;
    readonly minLight: number;
    readonly lightShare: number;
    /** A file is light when it reaches at most this share of the blast. */
    readonly lightReach: number;
  };
  /** A hub may grow by this share, plus this many packages, before it fails. */
  readonly growth: { readonly share: number; readonly packages: number };
};

export type Policy = {
  readonly limits: Limits;
  /** Blast radius, in packages, accepted for each hub. */
  readonly hubs: Readonly<Record<string, number>>;
  readonly grandfathered: {
    readonly size: Readonly<Record<string, Grandfathered<'files'>>>;
    readonly cohesion: Readonly<Record<string, Grandfathered<'light'>>>;
  };
  /** Tasks allowed a glob over every package, with how many and why. */
  readonly broadInputs: Readonly<
    Record<string, { readonly patterns: number; readonly reason: string }>
  >;
  readonly globalDependencies: readonly string[];
  readonly globalEnv: readonly string[];
};

export type Grandfathered<Key extends string> = { readonly reason: string } & {
  readonly [K in Key]: number;
};

export type Violation = {
  readonly rule: string;
  readonly subject: string;
  readonly message: string;
};

const SYNC = 'bun run cache:sync';

function share(count: number, of: number): string {
  return `${String(Math.round((count / of) * 100))}%`;
}

export type HubContext = {
  readonly packages: readonly GraphPackage[];
  readonly blast: ReadonlyMap<string, Blast>;
  readonly policy: Policy;
};

export function hubViolations(
  context: HubContext,
  reach: (pkg: GraphPackage) => LightFile[]
): Violation[] {
  const { packages, blast, policy } = context;
  const { limits } = policy;
  const violations: Violation[] = [];
  for (const pkg of packages) {
    const radius = blast.get(pkg.name)?.packages.size ?? 0;
    if (radius < limits.hubBlast) continue;
    const accepted = policy.hubs[pkg.name];
    const subject = pkg.name;
    if (accepted === undefined)
      violations.push(newHub(subject, radius, packages.length));
    else if (
      radius >
      accepted * (1 + limits.growth.share) + limits.growth.packages
    )
      violations.push(hubGrowth(subject, radius, accepted));
    violations.push(...sizeViolations(pkg, radius, policy));
    violations.push(...cohesionViolations(pkg, radius, policy, reach));
  }
  return violations;
}

function newHub(subject: string, radius: number, total: number): Violation {
  return {
    rule: 'hub-new',
    subject,
    message: [
      `${subject} reruns lint, tc and test in ${String(radius)} of ${String(total)} packages (${share(radius, total)}) whenever one of its files changes, and cache-hygiene.json does not list it as a hub.`,
      '  Why: every edit to it misses the cache in all of them.',
      `  Fix: keep it small and stable. \`bun run cache:explain ${subject}\` shows who pulls it in and which files could live elsewhere. Break an edge that is not needed (a package that only tests with it should declare it in devDependencies), or move what few packages use into its own package.`,
      `  If it is a deliberate foundation, run \`${SYNC} -- --accept-hubs\` and say why in the pull request.`,
    ].join('\n'),
  };
}

function hubGrowth(
  subject: string,
  radius: number,
  accepted: number
): Violation {
  return {
    rule: 'hub-growth',
    subject,
    message: [
      `${subject} now reruns ${String(radius)} packages per edit; cache-hygiene.json accepted ${String(accepted)}.`,
      '  Why: a new dependency edge made a stable package expensive to change, and the cache hits it used to give are gone.',
      `  Fix: \`bun run cache:explain ${subject}\` lists its dependents. Remove the edge that was added, import from a narrower package, or declare the dependency in devDependencies when only tests and scripts use it.`,
      `  If the growth is intended, run \`${SYNC} -- --accept-hubs\` and say why in the pull request.`,
    ].join('\n'),
  };
}

function sizeViolations(
  pkg: GraphPackage,
  radius: number,
  policy: Policy
): Violation[] {
  const { limits } = policy;
  const large = radius >= limits.largeHubBlast;
  const limit = large ? limits.maxFilesAtLargeHub : limits.maxFilesAtHub;
  const allowed = Math.max(
    limit,
    policy.grandfathered.size[pkg.name]?.files ?? 0
  );
  if (pkg.srcFiles.length <= allowed) return [];
  return [
    {
      rule: 'hub-size',
      subject: pkg.name,
      message: [
        `${pkg.name} has ${String(pkg.srcFiles.length)} source files and reruns ${String(radius)} packages per edit; the limit for a ${large ? 'large ' : ''}hub is ${String(allowed)} files.`,
        '  Why: the more it holds, the more often something in it changes, and each change misses the cache in every dependent.',
        `  Fix: split it by purpose. \`bun run cache:explain ${pkg.name}\` lists its files by how many packages they reach; the ones that reach few go to a package of their own (\`<domain>-<purpose>-<runtime>-ts\`), and dependents import the narrow one.`,
      ].join('\n'),
    },
  ];
}

export type LightFile = { readonly file: string; readonly packages: number };

function cohesionViolations(
  pkg: GraphPackage,
  radius: number,
  policy: Policy,
  reach: (pkg: GraphPackage) => LightFile[]
): Violation[] {
  const { cohesion } = policy.limits;
  if (pkg.srcFiles.length < cohesion.minFiles) return [];
  const light = reach(pkg);
  const allowed = policy.grandfathered.cohesion[pkg.name]?.light ?? 0;
  if (
    light.length < cohesion.minLight ||
    light.length < pkg.srcFiles.length * cohesion.lightShare ||
    light.length <= allowed
  )
    return [];
  const listed = light
    .slice(0, 8)
    .map((f) => `    ${f.file} (reaches ${String(f.packages)})`);
  return [
    {
      rule: 'hub-cohesion',
      subject: pkg.name,
      message: [
        `${pkg.name} reruns ${String(radius)} packages per edit, but ${String(light.length)} of its ${String(pkg.srcFiles.length)} source files reach ${String(Math.max(3, Math.floor(radius * cohesion.lightReach)))} packages or fewer:`,
        ...listed,
        light.length > listed.length
          ? `    ...and ${String(light.length - listed.length)} more`
          : '',
        '  Why: they share a hash with the files everyone uses, so each edit to them reruns all of its dependents for nothing.',
        '  Fix: move them to a package of their own (`<domain>-<purpose>-<runtime>-ts`) that depends on this one, and point the few importers at it.',
      ]
        .filter((line) => line !== '')
        .join('\n'),
    },
  ];
}

export type TaskInputs = {
  readonly task: string;
  readonly inputs: readonly string[];
};

const TIER_SEGMENT =
  /^(?:apps|libs|pkgs|\{(?:apps|libs|pkgs)(?:,(?:apps|libs|pkgs))*\})$/;

/** The `/`-separated segments of a glob, keeping `{a/b,c}` groups whole. */
function globSegments(glob: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of glob) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (char === '/' && depth === 0) {
      segments.push(current);
      current = '';
    } else current += char;
  }
  return [...segments, current];
}

/** A glob under `$TURBO_ROOT$` whose package-directory segment is a wildcard. */
export function isBroadInput(input: string): boolean {
  if (input.startsWith('!') || !input.startsWith('$TURBO_ROOT$/')) return false;
  const segments = globSegments(input.slice('$TURBO_ROOT$/'.length));
  const [first = '', second = ''] = segments;
  if (first.startsWith('*')) return true;
  if (first.startsWith('{') && first.includes('*')) return true;
  if (!TIER_SEGMENT.test(first) || segments.length < 2) return false;
  return second.replace(/\{[^{}*]*\}/g, '').includes('*');
}

export function broadInputViolations(
  tasks: readonly TaskInputs[],
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];
  for (const { task, inputs } of tasks) {
    const broad = inputs.filter(isBroadInput);
    if (broad.length === 0) continue;
    const allowed = policy.broadInputs[task];
    if (allowed !== undefined && broad.length <= allowed.patterns) continue;
    violations.push({
      rule: 'broad-input',
      subject: task,
      message: [
        allowed === undefined
          ? `${task} lists ${broad
              .map((p) => `\`${p}\``)
              .slice(0, 3)
              .join(
                ', '
              )}${broad.length > 3 ? ` and ${String(broad.length - 3)} more` : ''}, a glob over every package.`
          : `${task} lists ${String(broad.length)} globs over every package; cache-hygiene.json allows ${String(allowed.patterns)} (${allowed.reason}).`,
        '  Why: an edit to any matching file in any package reruns the task, so one dependency bump somewhere misses the cache here.',
        '  Fix: name the packages the task reads, as a brace list (`$TURBO_ROOT$/libs/{a,b}/package.json`), and add a test that fails when a package it should read is not listed, as `cache-package-paths.test.ts` does for the game manifests.',
        '  A task that scans the whole workspace on purpose (a repository gate) goes in `broadInputs` in cache-hygiene.json, with the number of globs and the reason.',
      ].join('\n'),
    });
  }
  return violations;
}

export type GlobalInputs = {
  readonly globalDependencies: readonly string[];
  readonly globalEnv: readonly string[];
  /** Whether `tsconfig.base.json` still carries `compilerOptions.paths`. */
  readonly baseHasAliases: boolean;
};

export function globalInputViolations(
  inputs: GlobalInputs,
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];
  const unlisted = (listed: readonly string[], allowed: readonly string[]) =>
    listed.filter((entry) => !allowed.includes(entry));
  for (const entry of unlisted(
    inputs.globalDependencies,
    policy.globalDependencies
  ))
    violations.push({
      rule: 'global-dependency',
      subject: entry,
      message: [
        `turbo.json lists \`${entry}\` in globalDependencies.`,
        '  Why: an edit to it reruns every task of every package, the whole corpus.',
        `  Fix: remove it from globalDependencies and add \`$TURBO_ROOT$/${entry}\` to the inputs of the tasks that read it.`,
        '  A file that really affects every task goes in `globalDependencies` in cache-hygiene.json, with the reason in the pull request.',
      ].join('\n'),
    });
  for (const entry of unlisted(inputs.globalEnv, policy.globalEnv))
    violations.push({
      rule: 'global-dependency',
      subject: entry,
      message: [
        `turbo.json lists \`${entry}\` in globalEnv.`,
        '  Why: changing the variable reruns every task of every package.',
        `  Fix: list it in \`env\` on the tasks that read it. A variable that really affects every task goes in \`globalEnv\` in cache-hygiene.json.`,
      ].join('\n'),
    });
  if (inputs.baseHasAliases)
    violations.push({
      rule: 'global-alias',
      subject: 'tsconfig.base.json',
      message: [
        'tsconfig.base.json has compilerOptions.paths.',
        '  Why: it is a global dependency, and every new or renamed package edits the aliases, so each one reran the whole corpus.',
        '  Fix: put the aliases in tsconfig.paths.json. Packages resolve each other through node_modules and their `exports`.',
      ].join('\n'),
    });
  return violations;
}

export type Drifted = {
  readonly srcEdges: readonly string[];
  readonly biomeSlices: readonly string[];
};

export function derivedViolations(drifted: Drifted): Violation[] {
  const entries: [string, string, readonly string[], string][] = [
    [
      'src edges',
      'a package lists `src` edges its imports do not call for',
      drifted.srcEdges,
      'it reruns its dependents on edits to packages only its tests use, or misses a real edge',
    ],
    [
      'Biome slices',
      'biome.shared.json or a biome-scope.json does not match biome.json',
      drifted.biomeSlices,
      'lint caches key on the slices, so a stale one hides a rule change or reruns every package',
    ],
  ];
  return entries
    .filter(([, , files]) => files.length > 0)
    .map(([rule, what, files, why]) => ({
      rule: 'derived',
      subject: rule,
      message: [
        `${String(files.length)} ${rule} out of date: ${what} (${files.slice(0, 4).join(', ')}${files.length > 4 ? ', ...' : ''}).`,
        `  Why: ${why}.`,
        `  Fix: \`${SYNC}\` rewrites them; commit the result.`,
      ].join('\n'),
    }));
}
