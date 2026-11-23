/**
 * A game is offered once in a space's game choice, whatever its modes: its
 * one tile opens the mode whose id is the game's family, and the other modes
 * are chosen among the game's choices. A person picking a mode taps its
 * game's tile, then the mode.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { DriverNode } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { ProductHarness } from './harness';

/** The family of the registered game `gameId`; a game with one mode is its own. */
export function gameFamilyOf(s: ProductHarness, gameId: string): string {
  const registered = s.harness.composition.app.turnGames.games.find(
    (game) => game.rules.id === gameId
  );
  return registered?.rules.family ?? gameId;
}

/** The tile `gameId` is picked by in the space's game choice: its game's. */
export function gameTile(s: ProductHarness, gameId: string): string {
  return Handles.gameMenu(gameFamilyOf(s, gameId));
}

/**
 * On the game's choices, set up the mode `gameId` when another mode of its
 * game is set up. Whether it tapped: the choices then change to that mode.
 */
export async function chooseGameMode(
  ui: { get(testId: string): DriverNode },
  gameId: string
): Promise<boolean> {
  const mode = ui.get(Handles.gameMode(gameId));
  if (!(await mode.isVisible())) return false;
  if ((await mode.attribute('aria-checked')) === 'true') return false;
  await mode.tap();
  return true;
}

/** Whether the game's choices show the mode `gameId`, or a game with one mode. */
export async function gameModeShown(
  ui: { get(testId: string): DriverNode },
  gameId: string
): Promise<boolean> {
  if (!(await ui.get(Handles.gameModes).isVisible())) return true;
  return (
    (await ui.get(Handles.gameMode(gameId)).attribute('aria-checked')) ===
    'true'
  );
}
