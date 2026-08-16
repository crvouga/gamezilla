/**
 * Stack + promise-`finally` ALS used when `globalThis.AsyncLocalStorage` is
 * missing or non-constructable (browser / Metro).
 */

export class StackAsyncLocalStorage<T> {
  private store: T | undefined;
  private readonly stack: Array<T | undefined> = [];

  disable(): void {}

  enable(): void {}

  enterWith(store: T): void {
    this.store = store;
  }

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    this.stack.push(this.store);
    this.store = store;
    try {
      const result = callback(...args);
      if (
        result != null &&
        typeof (result as unknown as { then?: unknown }).then === 'function'
      ) {
        return Promise.resolve(
          result as unknown as PromiseLike<unknown>
        ).finally(() => {
          this.store = this.stack.pop();
        }) as R;
      }
      this.store = this.stack.pop();
      return result;
    } catch (err) {
      this.store = this.stack.pop();
      throw err;
    }
  }
}
