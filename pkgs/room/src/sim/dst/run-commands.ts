import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';

import type { World } from '../world-api';

import type { RoomDstAction } from './actions';
import type { RoomDstApp } from './app';
import { playActionsOnWorld } from './play';
import {
  initialWorldModel,
  type WorldModel,
  type WorldReal,
} from './world-model';

export type WorldCmd = AsyncCommand<WorldModel, WorldReal>;

export function initialWorldState(
  app: RoomDstApp,
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

/** Model-run a command sequence, replay on World, optionally assert converge. */
export async function runCommandsOnWorld(args: {
  readonly app: RoomDstApp;
  readonly world: World;
  readonly cmds: Iterable<WorldCmd>;
  readonly settle?: boolean;
}): Promise<{ readonly actions: readonly RoomDstAction[] }> {
  const state = initialWorldState(args.app, args.world.clientIds);
  await fc.asyncModelRun(
    () => ({ model: state.model, real: state.real }),
    args.cmds
  );
  await playActionsOnWorld(args.app, args.world, state.real.actions);
  if (args.settle !== false) {
    await args.world.assertConverged();
  }
  return { actions: state.real.actions };
}
