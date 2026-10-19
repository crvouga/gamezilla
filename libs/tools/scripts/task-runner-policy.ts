/**
 * Turborepo is the only task runner, run by lint-package.ts.
 *
 * One way to run anything: `bun run <command>` at the root is a Turborepo
 * run, and every edge between two tasks is in `turbo.json`. That is what makes
 * a command's output one pane per task, its steps cacheable, and its order
 * something `turbo.json` states instead of a script line.
 *
 * - A root script is a **launcher** (`turbo run <tasks>`, or one of the gate's
 *   entry programs, which run turbo themselves), an **alias** of a launcher,
 *   or the **body** of a root task declared in `turbo.json`. A command's own
 *   body is `task:<command>`.
 * - No script runs another script: not by name (`bun run build`), not in
 *   another package (`--filter`, `--cwd`), not through a `pre` / `post` hook,
 *   and not in the background (`&`). That is `dependsOn` and `with`.
 * - Only the root starts turbo.
 * - Every task says how it is cached: `cache: false` for one that acts on the
 *   world, `inputs` and `outputs` for one that is a function of files.
 *
 * Pure over manifests and `turbo.json`, so it runs inside the cached `lint`.
 */

export type Scripts = Readonly<Record<string, string>>;
export type TurboTask = {
  readonly cache?: boolean;
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
};
export type TurboTasks = Readonly<Record<string, TurboTask>>;

/**
 * Root commands that cannot be a task, each for a property of Turborepo
 * itself. A task has no terminal of its own outside the UI (`interactive`
 * tasks refuse to run without it), so a command that reads one cannot be a
 * task. And turbo writes its own banner and summary to the stdout of a run,
 * so a command whose stdout is data for another program cannot be one either.
 */
export const ROOT_TERMINAL_COMMANDS: Readonly<Record<string, string>> = {
  obs: 'its stdout is the data agents parse (`--json`)',
  own: 'supervises an arbitrary command it is handed',
  psql: 'an interactive SQL prompt',
  'secrets:seed': 'reads each secret from the terminal, or from a pipe',
  'sims:open': 'an interactive simulator picker',
};

/** Programs a root launcher may start instead of `turbo`: each runs turbo. */
export const TURBO_ENTRY_PROGRAMS = [
  // Plans against the cache, then runs only the misses.
  'libs/tools/scripts/turbo-ci-run.ts',
  // The same, in a private snapshot holding the machine-wide verification slot.
  'libs/tools/scripts/verify-local.ts',
  // `turbo run @apps/product#dev` as the checkout's one supervised boot.
  'apps/product/scripts/dev-run.ts',
] as const;

/** Wrappers a launcher may sit behind: they only prepare its environment. */
const LAUNCHER_PREFIXES = [
  'bun run libs/secrets-server/scripts/secrets-run.ts -- ',
  'bun run own -- ',
] as const;

/** Named for what they collect; turbo-ci-run expands them, never runs them. */
const AGGREGATORS = new Set(['//#verify']);

/** Hooks the package manager runs itself; a script cannot depend on them. */
const PACKAGE_MANAGER_HOOKS = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepack',
  'postpack',
  'prepublishOnly',
]);

const ENV_ASSIGNMENT = /^[A-Z][A-Z0-9_]*=\S+\s+/;

function stripEnvironment(command: string): string {
  let rest = command.trim();
  for (;;) {
    const assignment = ENV_ASSIGNMENT.exec(rest);
    const prefix = LAUNCHER_PREFIXES.find((wrapper) =>
      rest.startsWith(wrapper)
    );
    if (assignment !== null) rest = rest.slice(assignment[0].length);
    else if (prefix !== undefined) rest = rest.slice(prefix.length);
    else return rest;
  }
}

/** The script names a command runs through the package manager. */
function scriptCalls(command: string, scripts: Scripts): readonly string[] {
  const calls: string[] = [];
  for (const match of command.matchAll(
    /\b(?:bun|npm|pnpm|yarn)\s+run\s+((?:--?[\w-]+(?:[= ]\S+)?\s+)*)([^\s-]\S*)/g
  )) {
    const name = match[2] ?? '';
    if (Object.hasOwn(scripts, name)) calls.push(name);
  }
  return calls;
}

function compositionViolations(
  name: string,
  command: string,
  scripts: Scripts
): readonly string[] {
  const out: string[] = [];
  if (/(?:^|\s)--(?:filter|cwd)(?:[=\s]|$)/.test(command))
    out.push(
      `\`${name}\` runs a script in another package (--filter / --cwd) — name that task in turbo.json (dependsOn) or run it with \`turbo run <package>#<task>\``
    );
  else
    for (const called of scriptCalls(command, scripts))
      out.push(
        `\`${name}\` runs the script \`${called}\` — a script never runs a script: make it a dependsOn in turbo.json`
      );
  if (/(?<!&)&(?!&)/.test(command.replace(/[<>]&|&>/g, '')))
    out.push(
      `\`${name}\` backgrounds a process (&) — processes that run side by side are Turborepo tasks`
    );
  return out;
}

function hookViolations(scripts: Scripts): readonly string[] {
  return Object.keys(scripts).flatMap((name) => {
    if (PACKAGE_MANAGER_HOOKS.has(name)) return [];
    const hooked = /^(?:pre|post)(.+)$/.exec(name)?.[1];
    return hooked !== undefined && Object.hasOwn(scripts, hooked)
      ? [
          `\`${name}\` runs around \`${hooked}\` as a package-manager hook — that order belongs in turbo.json (dependsOn)`,
        ]
      : [];
  });
}

/** A workspace package's scripts: each one is the body of one task. */
export function packageScriptViolations(args: {
  /** Repo-relative package directory, e.g. `apps/product`. */
  readonly pkg: string;
  readonly scripts: Scripts;
}): readonly string[] {
  const scripts = args.scripts;
  return [
    ...hookViolations(scripts),
    ...Object.entries(scripts).flatMap(([name, command]) => [
      ...compositionViolations(name, command, scripts),
      ...(/(?:^|[\s;&|])(?:bunx\s+(?:--no-install\s+)?)?turbo(?:\s|$)/.test(
        command
      )
        ? [
            `\`${name}\` starts turbo — only a root script does; inside a task, say what it needs in turbo.json`,
          ]
        : []),
    ]),
  ];
}

type RootScript =
  | { readonly kind: 'launcher'; readonly tasks: readonly string[] }
  | { readonly kind: 'entry' }
  | { readonly kind: 'alias'; readonly of: string }
  | { readonly kind: 'body' }
  | { readonly kind: 'terminal' }
  | { readonly kind: 'outside' };

function classifyRoot(
  name: string,
  command: string,
  scripts: Scripts,
  tasks: TurboTasks
): RootScript {
  const bare = stripEnvironment(command);
  const turbo = /^turbo run (.+)$/.exec(bare);
  if (turbo !== null) {
    const words = (turbo[1] ?? '').split(/\s+/);
    const flags = words.findIndex((word) => word.startsWith('-'));
    return {
      kind: 'launcher',
      tasks: flags === -1 ? words : words.slice(0, flags),
    };
  }
  if (Object.hasOwn(tasks, `//#${name}`) && !AGGREGATORS.has(`//#${name}`))
    return { kind: 'body' };
  if (
    TURBO_ENTRY_PROGRAMS.some(
      (program) =>
        bare === `bun run ${program}` || bare.startsWith(`bun run ${program} `)
    )
  )
    return { kind: 'entry' };
  const alias = /^bun run (?:--silent )?(\S+)$/.exec(bare);
  if (alias?.[1] !== undefined && Object.hasOwn(scripts, alias[1]))
    return { kind: 'alias', of: alias[1] };
  if (Object.hasOwn(ROOT_TERMINAL_COMMANDS, name)) return { kind: 'terminal' };
  return { kind: 'outside' };
}

function taskIsDeclared(id: string, tasks: TurboTasks): boolean {
  if (Object.hasOwn(tasks, id)) return true;
  const generic = id.includes('#') ? id.slice(id.indexOf('#') + 1) : id;
  return !id.startsWith('//#') && Object.hasOwn(tasks, generic);
}

/** The root manifest: every command people type is a Turborepo run. */
export function rootScriptViolations(args: {
  readonly scripts: Scripts;
  readonly tasks: TurboTasks;
}): readonly string[] {
  const { scripts, tasks } = args;
  const kinds = new Map(
    Object.entries(scripts).map(([name, command]) => [
      name,
      classifyRoot(name, command, scripts, tasks),
    ])
  );
  const out: string[] = [];
  for (const [name, kind] of kinds) {
    const command = scripts[name] ?? '';
    if (kind.kind === 'outside') {
      out.push(
        `\`${name}\` runs outside Turborepo — move its command to \`task:${name}\`, declare \`//#task:${name}\` in turbo.json, and make \`${name}\` \`turbo run //#task:${name} --\``
      );
      continue;
    }
    if (kind.kind === 'launcher') {
      if (/&&|\|\||[;|]|(?<!&)&(?!&)/.test(command)) {
        out.push(
          `\`${name}\` chains commands around turbo — a launcher is one \`turbo run\`; the order of its tasks is dependsOn`
        );
        continue;
      }
      if (kind.tasks.length === 0)
        out.push(`\`${name}\` runs turbo without naming a task`);
      for (const task of kind.tasks) {
        if (!taskIsDeclared(task, tasks))
          out.push(
            `\`${name}\` runs \`${task}\`, which turbo.json does not declare`
          );
      }
      continue;
    }
    if (kind.kind === 'alias') {
      const target = kinds.get(kind.of)?.kind;
      if (target === 'body' || target === 'outside')
        out.push(
          `\`${name}\` runs the task body \`${kind.of}\` directly — run it through turbo (\`turbo run //#${kind.of}\`)`
        );
      continue;
    }
    if (kind.kind === 'body') {
      out.push(...compositionViolations(name, command, scripts));
      const own = /^task:(.+)$/.exec(name)?.[1];
      if (own === undefined) continue;
      const launcher = kinds.get(own);
      if (
        launcher?.kind !== 'launcher' ||
        !launcher.tasks.includes(`//#${name}`)
      )
        out.push(
          `\`${name}\` is the body of the command \`${own}\`, but \`${own}\` does not run \`//#${name}\``
        );
    }
  }
  for (const name of Object.keys(ROOT_TERMINAL_COMMANDS)) {
    if (!Object.hasOwn(scripts, name))
      out.push(
        `\`${name}\` is listed as a terminal command but is not a root script — remove it from ROOT_TERMINAL_COMMANDS`
      );
  }
  return [...out, ...hookViolations(scripts)];
}

/** `turbo.json`: a task is cached on purpose or not at all. */
export function taskCachingViolations(tasks: TurboTasks): readonly string[] {
  return Object.entries(tasks).flatMap(([id, task]) => {
    if (task.cache === false || AGGREGATORS.has(id)) return [];
    const missing = (['inputs', 'outputs'] as const).filter(
      (key) => task[key] === undefined
    );
    return missing.length === 0
      ? []
      : [
          `\`${id}\` is cached without declaring its ${missing.join(' and ')} — say what it reads and writes, or set \`"cache": false\` if it acts on the world`,
        ];
  });
}
