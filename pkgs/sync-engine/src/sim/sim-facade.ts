import { createNetEffectRegistry } from './net-effect';
import { registerKit } from './scenario-dispose-hook';
import type { SyncSimRuntime } from './sim-api';
import { bindKitMethods, createArmCrashHook } from './sim-facade-parts';
import { kitFaultApi } from './sim-lifecycle';
import type { BootedSimKernel } from './sim-types';

/** Wire kernel ports into the public SyncSimRuntime facade. */
export function buildKitFacade(k: BootedSimKernel): SyncSimRuntime {
  const faultApi = kitFaultApi(k.faults);
  const netEffects = createNetEffectRegistry();
  const armCrashHook = createArmCrashHook(k, faultApi);
  const crashServer = async () => {
    k.unbindHttp();
  };

  let disposed = false;
  const kitRef: { current: SyncSimRuntime | null } = { current: null };
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
