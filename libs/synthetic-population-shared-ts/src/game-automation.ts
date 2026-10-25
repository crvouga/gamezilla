import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { GamePositionRules } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const FIND_AN_OPPONENT = Handles.gameChoice('multiplayer');

/** Resume the current game's choices before considering a fresh game choice. */
export async function openMultiplayer(
  driver: Driver,
  games: readonly { readonly rules: Pick<GamePositionRules, 'id'> }[],
  random: () => number
): Promise<void> {
  if (await driver.get(FIND_AN_OPPONENT).isVisible()) {
    await driver.get(FIND_AN_OPPONENT).tap();
    return;
  }
  const offered: (typeof games)[number][] = [];
  for (const game of games)
    if (await driver.get(Handles.gameMenu(game.rules.id)).isVisible())
      offered.push(game);
  if (offered.length === 0) return;
  const index =
    offered.length === 1 ? 0 : Math.floor(random() * offered.length);
  const selected = offered[index];
  if (selected === undefined) throw new Error('Invalid game selection draw');
  await driver.get(Handles.gameMenu(selected.rules.id)).tap();
  await driver.get(FIND_AN_OPPONENT).tap();
}

export function gameForPosition(
  games: readonly GameAutomation<Driver>[],
  position: string
): GameAutomation<Driver> {
  const matches = games.filter((game) => game.rules.recognizes(position));
  if (matches.length !== 1)
    throw new Error(
      'The current game has no unique registered automation adapter'
    );
  return matches[0]!;
}
