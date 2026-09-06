/** @jsxImportSource solid-js */
import {
  createContext,
  type JSX,
  type ParentProps,
  untrack,
  useContext,
} from 'solid-js';

export type DefinedContext<T> = {
  /** Mounts `props.value` for the subtree. */
  readonly Provider: (props: ParentProps<{ readonly value: T }>) => JSX.Element;
  /** Reads the value; throws a descriptive error when no provider is mounted. */
  readonly use: () => T;
  /** Reads the value or `undefined` when no provider is mounted. */
  readonly useOptional: () => T | undefined;
};

/**
 * Declares a required Solid context for an injected service (clock, kv,
 * logger, …). Providers are composition roots; consumers call `use()` and get
 * a uniform "provider missing" error instead of `undefined` at the call site.
 *
 * The value is treated as a stable service handle — it is not tracked. Pass
 * reactive data through signals/stores on the value itself when needed.
 */
export function defineContext<T>(name: string): DefinedContext<T> {
  const Ctx = createContext<T>();
  const use = (): T => {
    const value = useContext(Ctx);
    if (value === undefined) {
      throw new Error(
        `${name}: provider missing — wrap the tree with ${name}Provider`
      );
    }
    return value;
  };
  const useOptional = (): T | undefined => useContext(Ctx);
  const Provider = (props: ParentProps<{ readonly value: T }>): JSX.Element => {
    // Stable service handle: read once on mount by design (not tracked).
    const value = untrack(() => props.value);
    return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
  };
  return { Provider, use, useOptional };
}
