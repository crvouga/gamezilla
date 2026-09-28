import type { SyncHarnessRuntime } from './api';
import { bindKitMethods, createArmCrashHook } from './facade-parts';
import { kitFaultApi } from './lifecycle';
import { createNetEffectRegistry } from './net-effect';
import { registerKit } from './scenario-dispose-hook';
import type { BootedHarnessKernel } from './types';

/** Wire kernel ports into the public SyncHarnessRuntime facade. */
export function buildKitFacade(k: BootedHarnessKernel): SyncHarnessRuntime {
  const faultApi = kitFaultApi(k.faults);
  const netEffects = createNetEffectRegistry();
  const armCrashHook = createArmCrashHook(k, faultApi);
  const crashServer = async () => {
    k.unbindHttp();
  };

  let disposed = false;
  const kitRef: { current: SyncHarnessRuntime | null } = { current: null };
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
