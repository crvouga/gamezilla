/**
 * Isomorphic {@link AsyncLocalStorage} — no static `node:async_hooks` import.
 *
 * Uses `globalThis.AsyncLocalStorage` when it is a real constructable (Node,
 * Bun, Workers after the API wall installs `node:async_hooks`); otherwise
 * {@link StackAsyncLocalStorage}. Concurrent overlapping `run()` is unsupported
 * on the stack fallback — callers that share one ALS across concurrent work
 * must serialize, or install native ALS before the first `run`/`getStore`.
 *
 * The native/stack choice is deferred until first use so Worker entry can
 * polyfill `globalThis` after this module (and its singletons) evaluate.
 */

import { StackAsyncLocalStorage } from './stack-async-local-storage';

type NativeAlsCtor = new <T>() => {
  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R;
  getStore(): T | undefined;
  enterWith(store: T): void;
  disable(): void;
  enable(): void;
};

type AlsImpl<T> = StackAsyncLocalStorage<T> | InstanceType<NativeAlsCtor>;

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

/** Lazily resolved so Worker entry can polyfill `globalThis` before first use. */
let cachedNativeCtor: NativeAlsCtor | null | undefined;

function getNativeCtor(): NativeAlsCtor | null {
  if (cachedNativeCtor != null) return cachedNativeCtor;
  const resolved = resolveNativeCtor();
  // Only cache a successful native ctor — null must be re-probed after polyfill.
  if (resolved != null) {
    cachedNativeCtor = resolved;
  }
  return resolved;
}

/** Test helper — clears the cached native ctor so the next construction re-probes. */
export function resetAsyncLocalNativeCtorCacheForTests(): void {
  cachedNativeCtor = undefined;
}

/**
 * Drop-in for Node's `AsyncLocalStorage` that is safe to import from browser
 * bundles (no `node:async_hooks` specifier).
 */
export class AsyncLocalStorage<T> {
  private impl: AlsImpl<T> | undefined;

  private resolveImpl(): AlsImpl<T> {
    if (this.impl !== undefined) return this.impl;
    const NativeCtor = getNativeCtor();
    this.impl =
      NativeCtor != null
        ? new NativeCtor<T>()
        : new StackAsyncLocalStorage<T>();
    return this.impl;
  }

  disable(): void {
    this.resolveImpl().disable();
  }

  enable(): void {
    this.resolveImpl().enable();
  }

  enterWith(store: T): void {
    this.resolveImpl().enterWith(store);
  }

  getStore(): T | undefined {
    return this.resolveImpl().getStore() as T | undefined;
  }

  run<R>(store: T, callback: (...args: never[]) => R, ...args: never[]): R {
    return this.resolveImpl().run(
      store,
      callback as (...a: unknown[]) => R,
      ...args
    );
  }
}
