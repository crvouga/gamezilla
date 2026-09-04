import type { ExploreOptions, ReplayOptions, Report } from '../run/explore';
import type { RandomActionsReport } from '../run/random-actions';
import type { Run, RunOptions } from '../run/run';
import type { Session } from '../runtime/types';
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
import type { Recording } from './recording';
import {
  attachSystemRegistry,
  type RuntimeDef,
  type SystemCore,
  type SystemRegistry,
} from './registry';

export type System<S, Args = void> = SystemCore<S, Args> & {
  run(opts: RunOptions<S, Args>): Promise<Run<S>>;
  explore(opts?: ExploreOptions<S, Args>): Promise<Report>;
  replay(
    input: Recording | RandomActionsReport | string,
    opts?: ReplayOptions<S>
  ): Promise<Report>;
};

export function defineSystem<S, Args = void>(def: {
  readonly name: string;
  readonly create: (session: Session, args: Args) => Awaitable<S>;
  readonly args?: Args;
  readonly sample?: () => Gen<Args>;
}): System<S, Args> {
  if (!def.name) throw new Error('defineSystem: name is required');

  const registry: SystemRegistry<S> = {
    actions: [],
    properties: [],
    runtimeEntries: [],
    defaultRuntimeName: undefined,
  };

  const runtimes: string[] = [];

  const system = {
    [SYSTEM_TAG]: true as const,
    name: def.name,
    create: def.create,
    args: def.args as Args | undefined,
    sample: def.sample as (() => Gen<Args>) | undefined,
    get runtimes(): readonly string[] {
      return runtimes;
    },
    runtime(runtimeDef: RuntimeDef): void {
      if (!runtimeDef.name) throw new Error('system.runtime: name is required');
      if (registry.runtimeEntries.some((h) => h.name === runtimeDef.name)) {
        throw new Error(
          `system.runtime: duplicate runtime '${runtimeDef.name}' on '${def.name}'`
        );
      }
      if (runtimeDef.default === true) {
        if (registry.defaultRuntimeName !== undefined) {
          throw new Error(
            `system.runtime: second default runtime on '${def.name}' (already '${registry.defaultRuntimeName}')`
          );
        }
        registry.defaultRuntimeName = runtimeDef.name;
      }
      registry.runtimeEntries.push({
        name: runtimeDef.name,
        isDefault: runtimeDef.default === true,
        create: runtimeDef.create,
      });
      runtimes.push(runtimeDef.name);
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
    async run(opts: RunOptions<S, Args>): Promise<Run<S>> {
      const { run } = await import('../run/run');
      return run(system, opts);
    },
    async explore(opts?: ExploreOptions<S, Args>): Promise<Report> {
      const { explore } = await import('../run/explore');
      return explore(system, opts ?? {});
    },
    async replay(
      input: Recording | RandomActionsReport | string,
      opts?: ReplayOptions<S>
    ): Promise<Report> {
      const { replay } = await import('../run/explore');
      return replay(system, input, opts ?? {});
    },
  } satisfies System<S, Args>;

  attachSystemRegistry(system as SystemCore<S, unknown>, registry);
  return system;
}
