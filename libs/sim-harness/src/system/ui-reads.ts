import { actorUi } from './actor-ui';
import { actorHtml } from './observations';
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

/**
 * True when the actor's current page includes the screen `screenId` (its
 * `data-screen` marker, e.g. `more` for Settings, `spaces` for Spaces).
 */
export async function onScreen(
  s: ProductSim,
  actorId: string,
  screenId: string
): Promise<boolean> {
  const html = await actorHtml(s, actorId);
  return html?.includes(`data-screen="${screenId}"`) ?? false;
}
