/**
 * A game's menu keeps its quiet choices (History and stats, puzzle stats,
 * Settings, How to play) behind More, closed until a person opens it.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

/**
 * Open More on the game's menu, as a person does before a quiet choice.
 * Where the menu shows no More, or it is already open, nothing happens.
 */
export async function openMoreChoices(ui: Driver): Promise<void> {
  const more = ui.get(Handles.gameChoicesMore);
  if (!(await more.isVisible())) return;
  if ((await more.attribute('aria-expanded')) === 'true') return;
  await more.tap();
}
