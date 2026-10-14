/**
 * `specs/runtime/privacy-recovery.qnt` against recovery of saved data.
 * An active account comes back usable. A deleted account stays deleted.
 */

import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  prepareRecoveryCopy,
  recoverApp,
  recoveredAccountProfile,
  recoveredAccountUsable,
} from '@libs/runtime-harness/privacy-retention';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

async function view(w: QuintHarnessWorld): Promise<{
  readonly usable: boolean;
  readonly returned: boolean;
}> {
  return w.quiet.read(async (s) => {
    if (typeof s.probes.recoveryAccountId !== 'string')
      return { usable: false, returned: false };
    const usable = await recoveredAccountUsable(s);
    const profile = await recoveredAccountProfile(s);
    return { usable, returned: profile !== null };
  });
}

bindQuintModel<QuintHarnessWorld>({
  model: 'privacy-recovery',
  traces: 8,
  maxSteps: 4,
  timeoutMs: 180_000,
  actions: {
    init: async () => undefined,
    recoverActive: async (w) => {
      await w.s.apply(prepareRecoveryCopy, 'alice', false);
      await w.s.apply(recoverApp);
    },
    recoverDeleted: async (w) => {
      await w.s.apply(prepareRecoveryCopy, 'alice', true);
      await w.s.apply(recoverApp);
    },
  },
  observe: (w) => view(w),
});
