import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';

import type { DstAction } from './actions';
import type { DstApp } from './app';
import { playActionsOnWorld, resetClockSkews } from './play';
import {
  initialWorldModel,
  type WorldModel,
  type WorldReal,
} from './world-model';
import type { DstWorldSurface } from './world-surface';

export type WorldCmd = AsyncCommand<WorldModel, WorldReal>;

export function initialWorldState(
  app: DstApp,
  clientIds: readonly string[]
): {
  model: WorldModel;
  real: WorldReal;
} {
  return {
    model: initialWorldModel(app, clientIds),
    real: { clientIds, actions: [] },
  };
}

/** Model-run a command sequence, replay on DstWorldSurface, optionally assert converge. */
export async function runCommandsOnWorld(args: {
  readonly app: DstApp;
  readonly world: DstWorldSurface;
  readonly cmds: Iterable<WorldCmd>;
  readonly settle?: boolean;
}): Promise<{ readonly actions: readonly DstAction[] }> {
  const state = initialWorldState(args.app, args.world.clientIds);
  await fc.asyncModelRun(
    () => ({ model: state.model, real: state.real }),
    args.cmds
  );
  await playActionsOnWorld(args.app, args.world, state.real.actions);
  resetClockSkews(args.world);
  if (args.settle !== false) {
    await args.world.assertConverged();
  }
  return { actions: state.real.actions };
}
