import fc from 'fast-check';

import type { DstAction } from './actions';
import type { DstApp } from './app';
import {
  initialWorldState,
  replayActionsOnWorld,
  resetClockSkews,
  type WorldCmd,
  worldCommands,
} from './commands';
import {
  arbWorldKnobs,
  arbWorldSeed,
  openPbtWorld,
  type WorldKnobs,
} from './world-config';

export type RunShrunkWorldArgs = {
  readonly app: DstApp;
  readonly seed: number;
  readonly knobs: WorldKnobs;
  readonly cmds: Iterable<WorldCmd>;
  readonly settle?: boolean;
};

export type RunShrunkWorldResult = {
  readonly actions: readonly DstAction[];
};

/** Model-run a command sequence, replay on SimWorld, optionally assert converge. */
export async function runShrunkWorldProperty(
  args: RunShrunkWorldArgs
): Promise<RunShrunkWorldResult> {
  const opened = await openPbtWorld({
    app: args.app,
    seed: args.seed,
    knobs: args.knobs,
  });
  const clientIds = [...opened.clientIds];
  const state = initialWorldState(args.app, clientIds);
  try {
    await fc.asyncModelRun(
      () => ({ model: state.model, real: state.real }),
      args.cmds
    );
    await replayActionsOnWorld(args.app, opened.world, state.real.actions);
    resetClockSkews(opened.world);
    if (args.settle !== false) {
      await opened.world.assertConverged();
    }
    return { actions: state.real.actions };
  } finally {
    await opened.world.dispose();
  }
}

export function worldPropertyInputs(
  app: DstApp,
  maxCommands = 14
): fc.Arbitrary<[number, WorldKnobs, Iterable<WorldCmd>]> {
  return fc.tuple(arbWorldSeed(), arbWorldKnobs()).chain(([seed, knobs]) => {
    const ids = Array.from({ length: knobs.clientCount }, (_, i) => `c${i}`);
    return fc.tuple(
      fc.constant(seed),
      fc.constant(knobs),
      worldCommands(app, ids, maxCommands)
    );
  });
}
