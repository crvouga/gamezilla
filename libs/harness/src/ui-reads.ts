import { actorUi } from './actor-ui';
import type { ProductHarness } from './harness';
import { actorHtml } from './observations';

/** True when every tab the composed features contribute is visible. */
export async function tabsVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const tabs = s.harness.composition.clients.flatMap(
    (client) => client.tabs ?? []
  );
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
  s: ProductHarness,
  actorId: string,
  screenId: string
): Promise<boolean> {
  const html = await actorHtml(s, actorId);
  return html?.includes(`data-screen="${screenId}"`) ?? false;
}
