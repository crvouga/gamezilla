import { posix } from 'node:path';
import { JsonValues } from './json-values';

export type DryRunTask = {
  readonly taskId: string;
  readonly hash: string;
  readonly command: string;
  readonly directory: string;
  readonly dependencies?: unknown;
  readonly cache?:
    | { readonly status?: unknown; readonly source?: unknown }
    | undefined;
  readonly resolvedTaskDefinition?:
    | { readonly cache?: boolean | undefined }
    | undefined;
  /** Whether one of the changed paths the projection was given is an input. */
  readonly readsChange?: boolean;
};

export type GlobalCacheInputs = {
  readonly files?: Readonly<Record<string, string>>;
  readonly hashOfExternalDependencies?: string;
  readonly hashOfInternalDependencies?: string;
};

export type TurboDryRun = {
  readonly tasks: readonly DryRunTask[];
  readonly globalCacheInputs?: GlobalCacheInputs | undefined;
};

/**
 * Discard per-task input inventories before reading the next task, keeping
 * only whether they hold one of `changedPaths` (repository-relative).
 */
export function projectTurboDryRun(
  chunks: Iterable<string>,
  changedPaths?: readonly string[]
): TurboDryRun {
  const source = new JsonValues(chunks);
  try {
    return readDryRun(source, changedPaths);
  } finally {
    source.close();
  }
}

function readDryRun(
  source: JsonValues,
  changedPaths: readonly string[] | undefined
): TurboDryRun {
  source.consume('{');
  let tasks: DryRunTask[] | undefined;
  let globalCacheInputs: GlobalCacheInputs | undefined;
  let first = true;
  while (source.peek() !== '}') {
    if (!first) source.consume(',');
    const key: unknown = JSON.parse(source.value());
    if (typeof key !== 'string')
      throw new Error('turbo --dry=json: invalid key');
    source.consume(':');
    if (key === 'tasks') {
      if (tasks !== undefined)
        throw new Error('turbo --dry=json: duplicate tasks');
      tasks = readTasks(source, changedPaths);
    } else if (key === 'globalCacheInputs') {
      globalCacheInputs = JSON.parse(source.value()) as GlobalCacheInputs;
    } else JSON.parse(source.value());
    first = false;
  }
  source.consume('}');
  if (source.peek() !== undefined)
    throw new Error('turbo --dry=json: trailing data');
  if (tasks === undefined)
    throw new Error('turbo --dry=json: missing tasks array');
  return { tasks, globalCacheInputs };
}

function readTasks(
  source: JsonValues,
  changedPaths: readonly string[] | undefined
): DryRunTask[] {
  source.consume('[');
  const tasks: DryRunTask[] = [];
  let first = true;
  while (source.peek() !== ']') {
    if (!first) source.consume(',');
    const task = JSON.parse(source.value()) as DryRunTask & {
      readonly inputs?: unknown;
    };
    tasks.push({
      taskId: task.taskId,
      hash: task.hash,
      command: task.command,
      directory: task.directory,
      dependencies: task.dependencies,
      cache:
        task.cache === undefined
          ? undefined
          : {
              status: task.cache.status,
              source: task.cache.source,
            },
      resolvedTaskDefinition:
        task.resolvedTaskDefinition === undefined
          ? undefined
          : {
              cache: task.resolvedTaskDefinition.cache,
            },
      ...(changedPaths === undefined
        ? {}
        : { readsChange: readsAny(task, changedPaths) }),
    });
    first = false;
  }
  source.consume(']');
  return tasks;
}

/** Turbo keys a task's inputs by their path from its package directory. */
function readsAny(
  task: { readonly directory: string; readonly inputs?: unknown },
  paths: readonly string[]
): boolean {
  const inputs = task.inputs;
  if (typeof inputs !== 'object' || inputs === null) return false;
  return paths.some((path) =>
    Object.hasOwn(inputs, posix.relative(task.directory, path))
  );
}
