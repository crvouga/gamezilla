import type { CatalogSnapshot } from '../report/define-snapshot';
import type { ExploreOptions, ReplayOptions, Report } from '../run/explore';
import type { RandomActionsReport } from '../run/random-actions';
import type { Run, RunOptions } from '../run/run';
import type { Session } from '../runtime/types';
import type { Awaitable } from './awaitable';
import { buildRegistry } from './build-registry';
import type { RuntimeDef } from './define-runtime';
import { type CatalogAction, type CatalogProperty, SYSTEM_TAG } from './effect';
import type { Gen } from './gen';
import type { Recording } from './recording';
import { attachSystemRegistry, type SystemCore } from './registry';

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
  readonly runtimes: readonly RuntimeDef[];
  readonly actions?: readonly CatalogAction<S>[];
  readonly properties?: readonly CatalogProperty<S>[];
  readonly snapshots?: readonly CatalogSnapshot<S>[];
}): System<S, Args> {
  if (!def.name) throw new Error('defineSystem: name is required');

  const registry = buildRegistry({
    name: def.name,
    runtimes: def.runtimes,
    actions: def.actions ?? [],
    properties: def.properties ?? [],
    snapshots: def.snapshots ?? [],
  });

  const system = {
    [SYSTEM_TAG]: true as const,
    name: def.name,
    create: def.create,
    args: def.args as Args | undefined,
    sample: def.sample as (() => Gen<Args>) | undefined,
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
