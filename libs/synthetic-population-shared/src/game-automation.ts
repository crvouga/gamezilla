import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';

/** Resume the current game's menu before considering a fresh game choice. */
export async function openMultiplayer(
  driver: Driver,
  games: readonly GameAutomation<Driver>[],
  random: () => number
): Promise<void> {
  for (const game of games) {
    if (await driver.get(game.multiplayerControl).isVisible()) {
      await driver.get(game.multiplayerControl).tap();
      return;
    }
  }
  const offered: GameAutomation<Driver>[] = [];
  for (const game of games)
    if (await driver.get(game.selectControl).isVisible()) offered.push(game);
  if (offered.length === 0) return;
  const index =
    offered.length === 1 ? 0 : Math.floor(random() * offered.length);
  const selected = offered[index];
  if (selected === undefined) throw new Error('Invalid game selection draw');
  await driver.get(selected.selectControl).tap();
  await driver.get(selected.multiplayerControl).tap();
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
