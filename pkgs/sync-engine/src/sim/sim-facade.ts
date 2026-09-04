import type { SyncKit } from './kit-api';
import { bindKitMethods, createArmCrashHook } from './kit-facade-parts';
import { kitFaultApi } from './kit-lifecycle';
import type { BootedSimKernel } from './kit-types';
import { createNetEffectRegistry } from './net-effect';
import { registerKit } from './scenario-dispose-hook';

/** Wire kernel ports into the public SyncKit facade. */
export function buildKitFacade(k: BootedSimKernel): SyncKit {
  const faultApi = kitFaultApi(k.faults);
  const netEffects = createNetEffectRegistry();
  const armCrashHook = createArmCrashHook(k, faultApi);
  const crashServer = async () => {
    k.unbindHttp();
  };

  let disposed = false;
  const kitRef: { current: SyncKit | null } = { current: null };
  const kit = bindKitMethods({
    k,
    netEffects,
    armCrashHook,
    crashServer,
    faultApi,
    kitRef,
    markDisposed: () => {
      if (disposed) return true;
      disposed = true;
      return false;
    },
  });
  kitRef.current = kit;
  registerKit(kit);
  return kit;
}
