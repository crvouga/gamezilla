import { createNetEffectRegistry } from './net-effect';
import { registerSimWorld } from './scenario-dispose-hook';
import type { SimWorld } from './world';
import { bindWorldMethods, createArmCrashHook } from './world-facade-parts';
import { worldFaultApi } from './world-lifecycle';
import type { BootedSimKernel } from './world-types';

/** Wire kernel ports into the public SimWorld facade. */
export function buildSimWorldFacade(k: BootedSimKernel): SimWorld {
  const faultApi = worldFaultApi(k.faults);
  const netEffects = createNetEffectRegistry();
  const armCrashHook = createArmCrashHook(k, faultApi);
  const crashServer = async () => {
    k.unbindHttp();
  };

  let disposed = false;
  const worldRef: { current: SimWorld | null } = { current: null };
  const world = bindWorldMethods({
    k,
    netEffects,
    armCrashHook,
    crashServer,
    worldRef,
    markDisposed: () => {
      if (disposed) return true;
      disposed = true;
      return false;
    },
  });
  worldRef.current = world;
  registerSimWorld(world);
  return world;
}
