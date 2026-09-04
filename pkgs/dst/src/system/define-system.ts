import type { Host, Ports, Session } from '../host/types';
import type { Awaitable } from './awaitable';
import { defineAction } from './define-action';
import { defineProperty } from './define-property';
import {
  type Action,
  type ActionDef,
  type CatalogAction,
  type CatalogProperty,
  isAction,
  isProperty,
  type Property,
  type PropertyDef,
  SYSTEM_TAG,
} from './effect';
import type { Gen } from './gen';
import type { Repro } from './repro';

export type SystemCreate<S, Args = void> = (
  session: Session,
  args: Args
) => Awaitable<S>;

export type HostDef = {
  readonly name: string;
  readonly default?: boolean;
  readonly create: () => Awaitable<Host<Ports>>;
};

export type SystemHostEntry = {
  readonly name: string;
  readonly isDefault: boolean;
  readonly create: () => Awaitable<Host<Ports>>;
};

/** Package-internal catalogs hung on the system instance. */
export type SystemRegistry<S> = {
  readonly actions: CatalogAction<S>[];
  readonly properties: CatalogProperty<S>[];
  readonly hostEntries: SystemHostEntry[];
  defaultHostName: string | undefined;
};

export type System<S, Args = void> = {
  readonly [SYSTEM_TAG]: true;
  readonly name: string;
  readonly create: SystemCreate<S, Args>;
  readonly args: Args | undefined;
  readonly draw: (() => Gen<Args>) | undefined;
  readonly hosts: readonly string[];
  host(def: HostDef): void;
  action<const A extends unknown[] = []>(
    def: ActionDef<S, A> | Action<S, A>
  ): Action<S, A>;
  property<C = unknown>(
    def: PropertyDef<S, C> | Property<S, C>
  ): Property<S, C>;
  script(opts: ScriptOptionsPublic<S, Args>): Promise<ScriptPublic<S>>;
  explore(opts?: ExploreOptionsPublic<S, Args>): Promise<ReportPublic>;
  replay(
    input: Repro | WalkPublic | string,
    opts?: ReplayOptionsPublic<S>
  ): Promise<ReportPublic>;
};

/** Avoid circular type imports — mirror public Script / Report shapes. */
type ScriptPublic<S> = import('../script/script').Script<S>;
type WalkPublic = import('../script/walk').Walk;
type ReportPublic = import('../script/explore').Report;
type ScriptOptionsPublic<S, Args> = import('../script/script').ScriptOptions<
  S,
  Args
>;
type ExploreOptionsPublic<S, Args> = import('../script/explore').ExploreOptions<
  S,
  Args
>;
type ReplayOptionsPublic<S> = import('../script/explore').ReplayOptions<S>;

const registries = new WeakMap<object, SystemRegistry<unknown>>();

export function getSystemRegistry<S>(
  system: System<S, unknown>
): SystemRegistry<S> {
  const reg = registries.get(system as object);
  if (reg === undefined) {
    throw new Error('getSystemRegistry: system is not registered');
  }
  return reg as SystemRegistry<S>;
}

export function poolActions<S>(system: System<S, unknown>): CatalogAction<S>[] {
  return getSystemRegistry(system).actions.filter((a) => a.pool !== false);
}

export async function resolveHost(
  system: System<unknown, unknown>,
  hostName: string | undefined
): Promise<Host<Ports>> {
  const reg = getSystemRegistry(system);
  const name = hostName ?? reg.defaultHostName;
  if (name === undefined) {
    throw new Error(
      `system '${system.name}': no host registered (call system.host)`
    );
  }
  const entry = reg.hostEntries.find((h) => h.name === name);
  if (entry === undefined) {
    throw new Error(
      `system '${system.name}': unknown host '${name}' (have: ${reg.hostEntries.map((h) => h.name).join(', ')})`
    );
  }
  return await entry.create();
}

export function defineSystem<S, Args = void>(def: {
  readonly name: string;
  readonly create: (session: Session, args: Args) => Awaitable<S>;
  readonly args?: Args;
  readonly draw?: () => Gen<Args>;
}): System<S, Args> {
  if (!def.name) throw new Error('defineSystem: name is required');

  const registry: SystemRegistry<S> = {
    actions: [],
    properties: [],
    hostEntries: [],
    defaultHostName: undefined,
  };

  const hosts: string[] = [];

  const system = {
    [SYSTEM_TAG]: true as const,
    name: def.name,
    create: def.create,
    args: def.args as Args | undefined,
    draw: def.draw as (() => Gen<Args>) | undefined,
    get hosts(): readonly string[] {
      return hosts;
    },
    host(hostDef: HostDef): void {
      if (!hostDef.name) throw new Error('system.host: name is required');
      if (registry.hostEntries.some((h) => h.name === hostDef.name)) {
        throw new Error(
          `system.host: duplicate host '${hostDef.name}' on '${def.name}'`
        );
      }
      if (hostDef.default === true) {
        if (registry.defaultHostName !== undefined) {
          throw new Error(
            `system.host: second default host on '${def.name}' (already '${registry.defaultHostName}')`
          );
        }
        registry.defaultHostName = hostDef.name;
      }
      registry.hostEntries.push({
        name: hostDef.name,
        isDefault: hostDef.default === true,
        create: hostDef.create,
      });
      hosts.push(hostDef.name);
    },
    action<const A extends unknown[] = []>(
      actionDef: ActionDef<S, A> | Action<S, A>
    ): Action<S, A> {
      const action = isAction(actionDef)
        ? (actionDef as Action<S, A>)
        : defineAction(actionDef as ActionDef<S, A>);
      if (registry.actions.some((a) => a.name === action.name)) {
        throw new Error(
          `system.action: duplicate action '${action.name}' on '${def.name}'`
        );
      }
      registry.actions.push(action as unknown as CatalogAction<S>);
      return action;
    },
    property<C = unknown>(
      propertyDef: PropertyDef<S, C> | Property<S, C>
    ): Property<S, C> {
      const property = isProperty(propertyDef)
        ? (propertyDef as Property<S, C>)
        : defineProperty(propertyDef as PropertyDef<S, C>);
      if (registry.properties.some((p) => p.name === property.name)) {
        throw new Error(
          `system.property: duplicate property '${property.name}' on '${def.name}'`
        );
      }
      registry.properties.push(property as unknown as CatalogProperty<S>);
      return property;
    },
    async script(opts: ScriptOptionsPublic<S, Args>): Promise<ScriptPublic<S>> {
      const { script } = await import('../script/script');
      return script(system as System<S, Args>, opts);
    },
    async explore(opts?: ExploreOptionsPublic<S, Args>): Promise<ReportPublic> {
      const { explore } = await import('../script/explore');
      return explore(system as System<S, Args>, opts ?? {});
    },
    async replay(
      input: Repro | WalkPublic | string,
      opts?: ReplayOptionsPublic<S>
    ): Promise<ReportPublic> {
      const { replay } = await import('../script/explore');
      return replay(system as System<S, Args>, input, opts ?? {});
    },
  } satisfies System<S, Args>;

  registries.set(system as object, registry as SystemRegistry<unknown>);
  return system;
}

export type { SystemCreate as SystemGenerate };
