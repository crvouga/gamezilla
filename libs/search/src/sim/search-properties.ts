import type { ProductSim } from '@libs/sim-harness/system/sim';
import { productExtra } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';
import { defineProperty } from '@pkgs/sim';

/**
 * People search must not leave the focused actor on an eternal "Searching…"
 * spinner after the run has drained timers + in-process HTTP.
 */
export const searchDoesNotHang = defineProperty({
  name: 'searchDoesNotHang',
  check: async (s: ProductSim) => {
    const extra = productExtra(s);
    const activeId =
      extra.ui.kind === 'solid-dom'
        ? extra.ui.session?.activeActorId()
        : undefined;
    for (const [id, handle] of s.actors) {
      if (activeId !== undefined && id !== activeId) continue;
      const loading = handle.ui.get(Handles.searchLoading);
      if (!(await loading.isVisible())) continue;
      await loading.expect.hidden({
        timeoutMs: 10_000,
        description: `search settle for actor ${id}`,
      });
    }
  },
});
