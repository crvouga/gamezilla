import type { Snapshot, SnapshotDef } from '../report/define-snapshot';
import type { ExploreOptions, ReplayOptions, Report } from '../run/explore';
import type { RandomActionsReport } from '../run/random-actions';
import type { Run, RunOptions } from '../run/run';
import type { Session } from '../runtime/types';
import type { Awaitable } from './awaitable';
import {
  type Action,
  type ActionDef,
  type Property,
  type PropertyDef,
  SYSTEM_TAG,
} from './effect';
import type { Gen } from './gen';
import type { Recording } from './recording';
import {
  registerAction,
  registerProperty,
  registerRuntime,
  registerSnapshot,
} from './register-catalog';
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
    snapshots: [],
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
      registerRuntime(
        registry as SystemRegistry<unknown>,
        def.name,
        runtimes,
        runtimeDef
      );
    },
    action<const A extends unknown[] = []>(
      actionDef: ActionDef<S, A> | Action<S, A>
    ): Action<S, A> {
      return registerAction(registry, def.name, actionDef);
    },
    property<C = unknown>(
      propertyDef: PropertyDef<S, C> | Property<S, C>
    ): Property<S, C> {
      return registerProperty(registry, def.name, propertyDef);
    },
    snapshot<T = unknown>(
      snapshotDef: SnapshotDef<S, T> | Snapshot<S, T>
    ): Snapshot<S, T> {
      return registerSnapshot(registry, def.name, snapshotDef);
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
