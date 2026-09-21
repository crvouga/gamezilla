import { actorUi } from './actor-ui';
import type { ProductSim } from './sim';

/** True when every tab the composed features contribute is visible. */
export async function tabsVisible(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const tabs = s.sim.composition.clients.flatMap((client) => client.tabs ?? []);
  for (const tab of tabs) {
    if (!(await ui.get(tab.testID).isVisible())) return false;
  }
  return true;
}
