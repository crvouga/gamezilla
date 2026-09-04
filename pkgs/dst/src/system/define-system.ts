import type { Session } from '../host/types';
import type { ExploreOptions, ReplayOptions, Report } from '../script/explore';
import type { Script, ScriptOptions } from '../script/script';
import type { Walk } from '../script/walk';
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
import {
  attachSystemRegistry,
  type HostDef,
  type SystemCore,
  type SystemRegistry,
} from './registry';
import type { Repro } from './repro';

export type System<S, Args = void> = SystemCore<S, Args> & {
  script(opts: ScriptOptions<S, Args>): Promise<Script<S>>;
  explore(opts?: ExploreOptions<S, Args>): Promise<Report>;
  replay(
    input: Repro | Walk | string,
    opts?: ReplayOptions<S>
  ): Promise<Report>;
};

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
    async script(opts: ScriptOptions<S, Args>): Promise<Script<S>> {
      const { script } = await import('../script/script');
      return script(system, opts);
    },
    async explore(opts?: ExploreOptions<S, Args>): Promise<Report> {
      const { explore } = await import('../script/explore');
      return explore(system, opts ?? {});
    },
    async replay(
      input: Repro | Walk | string,
      opts?: ReplayOptions<S>
    ): Promise<Report> {
      const { replay } = await import('../script/explore');
      return replay(system, input, opts ?? {});
    },
  } satisfies System<S, Args>;

  attachSystemRegistry(system as SystemCore<S, unknown>, registry);
  return system;
}
