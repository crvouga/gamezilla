import { createNetEffectRegistry } from './net-effect';
import { registerWorld } from './scenario-dispose-hook';
import type { World } from './world-api';
import { bindWorldMethods, createArmCrashHook } from './world-facade-parts';
import { worldFaultApi } from './world-lifecycle';
import type { BootedSimKernel } from './world-types';

/** Wire kernel ports into the public World facade. */
export function buildWorldFacade(k: BootedSimKernel): World {
  const faultApi = worldFaultApi(k.faults);
  const netEffects = createNetEffectRegistry();
  const armCrashHook = createArmCrashHook(k, faultApi);
  const crashServer = async () => {
    k.unbindHttp();
  };

  let disposed = false;
  const worldRef: { current: World | null } = { current: null };
  const world = bindWorldMethods({
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
  worldRef.current = world;
  registerWorld(world);
  return world;
}
