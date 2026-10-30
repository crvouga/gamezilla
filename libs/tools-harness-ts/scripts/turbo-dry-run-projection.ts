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

/** Discard per-task input inventories before reading the next task. */
export function projectTurboDryRun(chunks: Iterable<string>): TurboDryRun {
  const source = new JsonValues(chunks);
  try {
    return readDryRun(source);
  } finally {
    source.close();
  }
}

function readDryRun(source: JsonValues): TurboDryRun {
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
      tasks = readTasks(source);
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

function readTasks(source: JsonValues): DryRunTask[] {
  source.consume('[');
  const tasks: DryRunTask[] = [];
  let first = true;
  while (source.peek() !== ']') {
    if (!first) source.consume(',');
    const task = JSON.parse(source.value()) as DryRunTask;
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
    });
    first = false;
  }
  source.consume(']');
  return tasks;
}
