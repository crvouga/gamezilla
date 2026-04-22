import type { ITask, TaskWrapper } from './interface';

const NOT_EXECUTED = Symbol('NOT_EXECUTED');

export class Task<T = void> implements ITask<T> {
  readonly id: string;

  private readonly _deps = new Set<ITask<unknown>>();
  private _result: { value: T } | typeof NOT_EXECUTED = NOT_EXECUTED;
  private readonly _fn: () => Promise<T>;

  constructor(id: string, fn: () => Promise<T>) {
    this.id = id;
    this._fn = fn;
  }

  get result(): T {
    if (this._result === NOT_EXECUTED) {
      throw new Error(`Task "${this.id}" has not been executed yet`);
    }
    return this._result.value;
  }

  get deps(): ReadonlySet<ITask<unknown>> {
    return this._deps;
  }

  dependsOn(...tasks: ITask<unknown>[]): this {
    for (const t of tasks) {
      this._deps.add(t);
    }
    return this;
  }

  /** @internal — called by TaskRunner, not by consumers. */
  async execute(wrap?: TaskWrapper): Promise<void> {
    const fn = this._fn;
    const value = wrap
      ? await (wrap as <U>(t: ITask<U>, f: () => Promise<U>) => Promise<U>)(
          this,
          fn,
        )
      : await fn();
    this._result = { value };
  }
}
