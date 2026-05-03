export interface ITask<T = void> {
  readonly id: string;
  readonly result: T;
  readonly deps: ReadonlySet<ITask<unknown>>;
  dependsOn(...tasks: ITask<unknown>[]): this;
}

export interface ITaskRunner {
  run(tasks: Iterable<ITask<unknown>>): Promise<void>;
}

/**
 * Optional wrapper invoked around each task's execution.
 * Use this to inject CI logging, timing, grouping, etc.
 * without coupling the library to any specific platform.
 */
export type TaskWrapper = <T>(
  task: ITask<T>,
  fn: () => Promise<T>
) => Promise<T>;
