/**
 * System registry — the part of a `System` the script / walk / explore
 * runtime needs. Lives apart from `define-system.ts` so the runtime never
 * imports the module that (lazily) imports the runtime.
 */

import type { Ports, Runtime, Session } from '../runtime/types';
import type { Awaitable } from './awaitable';
import type {
  Action,
  ActionDef,
  CatalogAction,
  CatalogProperty,
  Property,
  PropertyDef,
  SYSTEM_TAG,
} from './effect';
import type { Gen } from './gen';

export type SystemCreate<S, Args = void> = (
  session: Session,
  args: Args
) => Awaitable<S>;

export type RuntimeDef = {
  readonly name: string;
  readonly default?: boolean;
  readonly create: () => Awaitable<Runtime<Ports>>;
};

export type SystemRuntimeEntry = {
  readonly name: string;
  readonly isDefault: boolean;
  readonly create: () => Awaitable<Runtime<Ports>>;
};

/** Package-internal catalogs hung on the system instance. */
export type SystemRegistry<S> = {
  readonly actions: CatalogAction<S>[];
  readonly properties: CatalogProperty<S>[];
  readonly runtimeEntries: SystemRuntimeEntry[];
  defaultRuntimeName: string | undefined;
};

/** Declaration + registration surface; `System` adds `script` / `explore` / `replay`. */
export type SystemCore<S, Args = void> = {
  readonly [SYSTEM_TAG]: true;
  readonly name: string;
  readonly create: SystemCreate<S, Args>;
  readonly args: Args | undefined;
  readonly sample: (() => Gen<Args>) | undefined;
  readonly runtimes: readonly string[];
  runtime(def: RuntimeDef): void;
  action<const A extends unknown[] = []>(
    def: ActionDef<S, A> | Action<S, A>
  ): Action<S, A>;
  property<C = unknown>(
    def: PropertyDef<S, C> | Property<S, C>
  ): Property<S, C>;
};

const registries = new WeakMap<object, SystemRegistry<unknown>>();

export function attachSystemRegistry<S>(
  system: SystemCore<S, unknown>,
  registry: SystemRegistry<S>
): void {
  registries.set(system as object, registry as SystemRegistry<unknown>);
}

export function getSystemRegistry<S>(
  system: SystemCore<S, unknown>
): SystemRegistry<S> {
  const reg = registries.get(system as object);
  if (reg === undefined) {
    throw new Error('getSystemRegistry: system is not registered');
  }
  return reg as SystemRegistry<S>;
}

export function poolActions<S>(
  system: SystemCore<S, unknown>
): CatalogAction<S>[] {
  return getSystemRegistry(system).actions.filter((a) => a.pool !== false);
}

/** A walk / explore slice: registered action names or action objects. */
export type ActionSlice<S> = readonly (string | CatalogAction<S>)[];

/**
 * Resolve a slice to catalog actions. Names look up the registry (any
 * registered action, including `pool: false`); objects pass through.
 */
export function resolveActions<S>(
  system: SystemCore<S, unknown>,
  slice: ActionSlice<S> | undefined
): CatalogAction<S>[] {
  if (slice === undefined) return poolActions(system);
  const registered = getSystemRegistry(system).actions;
  return slice.map((entry) => {
    if (typeof entry !== 'string') return entry;
    const found = registered.find((a) => a.name === entry);
    if (found === undefined) {
      throw new Error(
        `system '${system.name}': unknown action '${entry}' (have: ${registered.map((a) => a.name).join(', ')})`
      );
    }
    return found;
  });
}

export async function resolveRuntime(
  system: SystemCore<unknown, unknown>,
  runtimeName: string | undefined
): Promise<Runtime<Ports>> {
  const reg = getSystemRegistry(system);
  const name = runtimeName ?? reg.defaultRuntimeName;
  if (name === undefined) {
    throw new Error(
      `system '${system.name}': no runtime registered (call system.runtime)`
    );
  }
  const entry = reg.runtimeEntries.find((h) => h.name === name);
  if (entry === undefined) {
    throw new Error(
      `system '${system.name}': unknown runtime '${name}' (have: ${reg.runtimeEntries.map((h) => h.name).join(', ')})`
    );
  }
  return await entry.create();
}
