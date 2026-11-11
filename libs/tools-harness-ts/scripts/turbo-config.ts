/**
 * The task definitions Turborepo runs, read the way Turborepo reads them.
 *
 * The root `turbo.json` holds the generic tasks (`lint`, `test`, …), the root
 * tasks (`//#…`) and the global settings. Everything one package owns lives in
 * that package's own `turbo.json` (`extends: ["//"]`), so concurrent changes to
 * different packages never touch one shared file.
 *
 * `readTurboTasks` returns one map over both: every root entry as written, and
 * `<package>#<task>` for every task a package's `turbo.json` declares, resolved
 * the way Turborepo resolves it — the root `<package>#<task>` (or else the root
 * `<task>`) first, then the package's fields on top, each replacing the inherited
 * one unless it lists `$TURBO_EXTENDS$`, which splices the inherited list in.
 * Checks that read task definitions read this map, never one file alone.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type TurboTask = {
  readonly dependsOn?: readonly string[];
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
  readonly env?: readonly string[];
  readonly passThroughEnv?: readonly string[];
  readonly with?: readonly string[];
  readonly cache?: boolean;
  readonly persistent?: boolean;
  readonly interactive?: boolean;
  readonly interruptible?: boolean;
  readonly outputLogs?: string;
};
export type TurboTasks = Readonly<Record<string, TurboTask>>;

export type TurboFile = {
  readonly extends?: readonly string[];
  readonly globalDependencies?: readonly string[];
  readonly globalEnv?: readonly string[];
  readonly globalPassThroughEnv?: readonly string[];
  readonly tasks?: TurboTasks;
};

/** One workspace package's own `turbo.json`, `undefined` when it has none. */
export type PackageTurboFile = {
  readonly name: string;
  readonly dir: string;
  readonly file: TurboFile;
};

const REPO_ROOT = join(import.meta.dirname, '../../..');
const TIERS = ['apps', 'libs', 'pkgs'] as const;
const EXTENDS = '$TURBO_EXTENDS$';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** The root `turbo.json` as written: global settings, generic and root tasks. */
export function readRootTurbo(root = REPO_ROOT): TurboFile {
  return readJson<TurboFile>(join(root, 'turbo.json'));
}

/** Every workspace package that has its own `turbo.json`, in directory order. */
export function readPackageTurbos(root = REPO_ROOT): PackageTurboFile[] {
  const out: PackageTurboFile[] = [];
  for (const tier of TIERS) {
    const tierDir = join(root, tier);
    if (!existsSync(tierDir)) continue;
    for (const entry of readdirSync(tierDir).sort()) {
      const dir = `${tier}/${entry}`;
      const manifest = join(root, dir, 'package.json');
      const turbo = join(root, dir, 'turbo.json');
      if (!(existsSync(manifest) && existsSync(turbo))) continue;
      out.push({
        name: readJson<{ name: string }>(manifest).name,
        dir,
        file: readJson<TurboFile>(turbo),
      });
    }
  }
  return out;
}

/** A package's task over the definition it extends, as Turborepo merges them. */
export function resolvePackageTask(
  inherited: TurboTask | undefined,
  own: TurboTask
): TurboTask {
  const merged: Record<string, unknown> = { ...inherited };
  for (const [field, value] of Object.entries(own)) {
    const base = (inherited as Record<string, unknown> | undefined)?.[field];
    merged[field] =
      Array.isArray(value) && value.includes(EXTENDS)
        ? value.flatMap((item: unknown) =>
            item === EXTENDS ? ((base as unknown[] | undefined) ?? []) : [item]
          )
        : value;
  }
  return merged as TurboTask;
}

/**
 * Every task definition: the root's as written, plus `<package>#<task>` for each
 * task a package's own `turbo.json` declares, resolved over what it extends.
 */
export function readTurboTasks(root = REPO_ROOT): TurboTasks {
  const rootTasks = readRootTurbo(root).tasks ?? {};
  const tasks: Record<string, TurboTask> = { ...rootTasks };
  for (const { name, file } of readPackageTurbos(root))
    for (const [task, own] of Object.entries(file.tasks ?? {})) {
      const id = `${name}#${task}`;
      tasks[id] = resolvePackageTask(rootTasks[id] ?? rootTasks[task], own);
    }
  return tasks;
}

/**
 * Package task fields that list `$TURBO_EXTENDS$` with nothing to extend: no
 * root `<package>#<task>` or `<task>` defines the field, so Turborepo splices
 * in nothing and the task silently loses the definition it meant to inherit.
 */
export function danglingExtends(root = REPO_ROOT): readonly string[] {
  const rootTasks = readRootTurbo(root).tasks ?? {};
  return readPackageTurbos(root).flatMap(({ name, dir, file }) =>
    Object.entries(file.tasks ?? {}).flatMap(([task, own]) => {
      const inherited = rootTasks[`${name}#${task}`] ?? rootTasks[task];
      return Object.entries(own)
        .filter(
          ([field, value]) =>
            Array.isArray(value) &&
            value.includes(EXTENDS) &&
            (inherited as Record<string, unknown> | undefined)?.[field] ===
              undefined
        )
        .map(
          ([field]) =>
            `${dir}/turbo.json: ${task}.${field} extends nothing — no root "${task}" defines ${field}; declare the whole definition here`
        );
    })
  );
}
