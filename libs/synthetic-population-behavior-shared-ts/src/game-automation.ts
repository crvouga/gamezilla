import type { OpponentDemand } from '@libs/synthetic-population-shared-ts/decision-policy';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { GamePositionRules } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const FIND_AN_OPPONENT = Handles.gameChoice('multiplayer');

/**
 * Resume the current game's choices before considering a fresh game choice.
 * A fresh choice takes a `preferred` game when the space offers one (a game
 * a person waits in, or a favorite), otherwise any game the space offers.
 */
export async function openMultiplayer(
  driver: Driver,
  games: readonly { readonly rules: Pick<GamePositionRules, 'id'> }[],
  random: () => number,
  preferred: readonly string[] = []
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
  const favored = offered.filter((game) => preferred.includes(game.rules.id));
  const choices = favored.length > 0 ? favored : offered;
  const index =
    choices.length === 1 ? 0 : Math.floor(random() * choices.length);
  const selected = choices[index];
  if (selected === undefined) throw new Error('Invalid game selection draw');
  await driver.get(Handles.gameMenu(selected.rules.id)).tap();
  await driver.get(FIND_AN_OPPONENT).tap();
}

/**
 * Find an opponent for the game a person waits in, through the same
 * controls a person uses: back to the space's games when another game is
 * open, that game's menu, finding an opponent, the person's match choice,
 * then Find. `false` when the way there is not on screen.
 */
export async function findOpponentFor(
  driver: Driver,
  demand: OpponentDemand
): Promise<boolean> {
  for (let step = 0; step < 8; step += 1) {
    if (await driver.get(Handles.gameMenu(demand.gameId)).isVisible()) {
      await driver.get(Handles.gameMenu(demand.gameId)).tap();
      await driver.get(FIND_AN_OPPONENT).tap();
      await driver.get('multiplayer-find').wait('visible');
      const clock = demand.timeControl.split('/').at(-1) ?? '';
      const choice = driver.get(
        `multiplayer-time-control-${clock.replace('+', '-')}`
      );
      if (await choice.isVisible()) await choice.tap();
      await driver.get('multiplayer-find').tap();
      return true;
    }
    if (!(await driver.get(Handles.navBack).isVisible())) return false;
    await driver.get(Handles.navBack).tap();
  }
  return false;
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
