/**
 * Isomorphic {@link AsyncLocalStorage} — no static `node:async_hooks` import.
 *
 * Uses `globalThis.AsyncLocalStorage` when it is a real constructable (Node,
 * Bun, Workers with `nodejs_compat`); otherwise {@link StackAsyncLocalStorage}.
 * Concurrent overlapping `run()` is unsupported on the stack fallback —
 * callers that share one ALS across concurrent work must serialize.
 */

import { StackAsyncLocalStorage } from './stack-async-local-storage';

type NativeAlsCtor = new <T>() => {
  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R;
  getStore(): T | undefined;
  enterWith(store: T): void;
  disable(): void;
  enable(): void;
};

function resolveNativeCtor(): NativeAlsCtor | null {
  const candidate = (globalThis as { AsyncLocalStorage?: unknown })
    .AsyncLocalStorage;
  if (typeof candidate !== 'function') return null;
  try {
    const probe = new (candidate as NativeAlsCtor)<unknown>();
    if (
      typeof probe.run !== 'function' ||
      typeof probe.getStore !== 'function'
    ) {
      return null;
    }
    return candidate as NativeAlsCtor;
  } catch {
    return null;
  }
}

const NativeCtor = resolveNativeCtor();

/**
 * Drop-in for Node's `AsyncLocalStorage` that is safe to import from browser
 * / Metro bundles (no `node:async_hooks` specifier).
 */
export class AsyncLocalStorage<T> {
  private readonly impl:
    | StackAsyncLocalStorage<T>
    | InstanceType<NativeAlsCtor>;

  constructor() {
    this.impl =
      NativeCtor != null
        ? new NativeCtor<T>()
        : new StackAsyncLocalStorage<T>();
  }

  disable(): void {
    this.impl.disable();
  }

  enable(): void {
    this.impl.enable();
  }

  enterWith(store: T): void {
    this.impl.enterWith(store);
  }

  getStore(): T | undefined {
    return this.impl.getStore() as T | undefined;
  }

  run<R>(store: T, callback: (...args: never[]) => R, ...args: never[]): R {
    return this.impl.run(store, callback as (...a: unknown[]) => R, ...args);
  }
}
