import type { DstApp } from './dst/app';
import type { WorldKnobs } from './dst/knobs';
import {
  playActionsOnWorld,
  resetClockSkews,
  runWithInvariants,
} from './dst/play';
import { runCommandsOnWorld } from './dst/run-commands';
import { createNetEffectRegistry } from './net-effect';
import { registerWorld } from './scenario-dispose-hook';
import type { World } from './world-api';
import { bindWorldMethods, createArmCrashHook } from './world-facade-parts';
import { worldFaultApi } from './world-lifecycle';
import type { BootedSimKernel } from './world-types';

export type BuildWorldFacadeOpts = {
  readonly dstApp?: DstApp;
  readonly knobs?: WorldKnobs | null;
};

/** Wire kernel ports into the public World facade. */
export function buildWorldFacade(
  k: BootedSimKernel,
  opts: BuildWorldFacadeOpts = {}
): World {
  const faultApi = worldFaultApi(k.faults);
  const netEffects = createNetEffectRegistry();
  const armCrashHook = createArmCrashHook(k, faultApi);
  const crashServer = async () => {
    k.unbindHttp();
  };

  let disposed = false;
  const worldRef: { current: World | null } = { current: null };
  const clientIds: string[] = [];
  const base = bindWorldMethods({
    k,
    netEffects,
    armCrashHook,
    crashServer,
    faultApi,
    worldRef,
    markDisposed: () => {
      if (disposed) return true;
      disposed = true;
      return false;
    },
  });

  const dstApp = opts.dstApp;
  const requireApp = (): DstApp => {
    if (dstApp === undefined) {
      throw new Error('DST method requires openWorld({ app })');
    }
    return dstApp;
  };

  const world: World = {
    ...base,
    clientIds,
    knobs: opts.knobs ?? null,
    playActions: (actions) => playActionsOnWorld(requireApp(), world, actions),
    runCommands: async (cmds) => {
      await runCommandsOnWorld({ app: requireApp(), world, cmds });
    },
    resetClockSkews: () => resetClockSkews(world),
    runWithInvariants: (run) => runWithInvariants(world, run),
  };
  worldRef.current = world;
  registerWorld(world);
  return world;
}
