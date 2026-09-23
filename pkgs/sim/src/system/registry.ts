/**
 * System registry — the part of a `System` the script / walk / explore
 * runtime needs. Lives apart from `define-system.ts` so the runtime never
 * imports the module that (lazily) imports the runtime.
 */

import type { CatalogSnapshot } from '../report/define-snapshot';
import type { Ports, Runtime, Session } from '../runtime/types';
import type { Awaitable } from './awaitable';
import { isRuntimeDef, type RuntimeDef } from './define-runtime';
import type { CatalogAction, CatalogProperty, SYSTEM_TAG } from './effect';
import type { Gen } from './gen';

export type { RuntimeDef } from './define-runtime';

export type SystemCreate<S, Args = void> = (
  session: Session,
  args: Args
) => Awaitable<S>;

export type SystemRuntimeEntry = {
  readonly name: string;
  readonly isDefault: boolean;
  readonly create: () => Awaitable<Runtime<Ports>>;
};

/** Package-internal catalogs hung on the system instance. */
export type SystemRegistry<S> = {
  readonly actions: CatalogAction<S>[];
  readonly properties: CatalogProperty<S>[];
  readonly snapshots: CatalogSnapshot<S>[];
  readonly runtimeEntries: readonly SystemRuntimeEntry[];
  readonly defaultRuntimeName: string;
};

/** Declaration surface; `System` adds `run` / `explore` / `replay`. */
export type SystemCore<S, Args = void> = {
  readonly [SYSTEM_TAG]: true;
  readonly name: string;
  readonly create: SystemCreate<S, Args>;
  readonly args: Args | undefined;
  readonly sample: (() => Gen<Args>) | undefined;
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

/** Harness-selected runtime for runs that name none (see `System.useRuntime`). */
const selectedRuntimes = new WeakMap<object, string>();

export function selectDefaultRuntime<S>(
  system: SystemCore<S, unknown>,
  name: string
): void {
  const reg = getSystemRegistry(system);
  if (!reg.runtimeEntries.some((entry) => entry.name === name)) {
    throw new Error(
      `system '${system.name}': unknown runtime '${name}' (have: ${reg.runtimeEntries.map((h) => h.name).join(', ')})`
    );
  }
  selectedRuntimes.set(system as object, name);
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

/** Runtime pick: registered name, or an inline RuntimeDef. */
export type RuntimeOption = string | RuntimeDef;

export type ResolvedRuntime = {
  readonly name: string;
  readonly runtime: Runtime<Ports>;
};

export async function resolveRuntime(
  system: SystemCore<unknown, unknown>,
  runtime: RuntimeOption | undefined
): Promise<ResolvedRuntime> {
  if (isRuntimeDef(runtime)) {
    return { name: runtime.name, runtime: await runtime.create() };
  }
  const reg = getSystemRegistry(system);
  const name =
    runtime ?? selectedRuntimes.get(system as object) ?? reg.defaultRuntimeName;
  const entry = reg.runtimeEntries.find((h) => h.name === name);
  if (entry === undefined) {
    throw new Error(
      `system '${system.name}': unknown runtime '${name}' (have: ${reg.runtimeEntries.map((h) => h.name).join(', ')})`
    );
  }
  return { name: entry.name, runtime: await entry.create() };
}
