/**
 * A game is offered once in a space's game choice, whatever its modes: its
 * one tile opens the mode whose id is the game's family, and the other modes
 * are chosen during setup. A person picking a mode taps its
 * game's tile, opens a setup, then picks the mode.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { DriverNode } from '@pkgs/ui-testing-root-shared-ts/driver';
import { pollUntil } from './actor-ui';
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
 * On a setup screen, choose the mode `gameId` when another mode of its
 * game is set up. Whether it tapped: the setup then changes to that mode.
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

export async function selectedSetupMode(
  ui: { get(testId: string): DriverNode },
  gameId: string
): Promise<boolean> {
  return (
    (await ui.get(Handles.gameMode(gameId)).attribute('aria-checked')) ===
    'true'
  );
}

/** Choose a mode on the setup screen and wait for the room to show it. */
export async function setUpGameMode(
  s: ProductHarness,
  ui: { get(testId: string): DriverNode },
  gameId: string
): Promise<void> {
  await pollUntil(
    s,
    async () => {
      if (await selectedSetupMode(ui, gameId)) return true;
      await chooseGameMode(ui, gameId);
      return null;
    },
    { maxMs: 15_000, stepMs: 1, description: `the setup of ${gameId}` }
  );
}
