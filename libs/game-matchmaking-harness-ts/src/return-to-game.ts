/**
 * Returning to one's unfinished game, from wherever the device is: the
 * offer (docked above the tabs, over a space, or in place of seeking an
 * opponent) and the one step it takes back to the game's board.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

/** Every offer to return to a game carries this test id. */
const RETURN_TO_GAME = 'return-to-game';
/** Its one command. */
const RETURN_TO_GAME_GO = `${RETURN_TO_GAME}-go`;
/** Finding an opponent's one command, offered only while one may seek. */
const SEEK = 'multiplayer-find';
/** What the game's choices say finding an opponent offers (`data-offer`). */
const FIND_OPPONENT_OFFER = 'game-choice-multiplayer-offer';

/** Which unfinished game a device offers to return to. */
export type ReturnOffered = 'custom' | 'matched' | null;

/** The game `actor`'s device offers to return to, or `null` when none. */
export async function returnToGameOffered(
  s: ProductHarness,
  actor: string
): Promise<ReturnOffered> {
  await bringToFront(s, actor);
  const offer = (await actorUi(s, actor)).get(RETURN_TO_GAME);
  if (!(await offer.isVisible())) return null;
  const kind = await offer.attribute('data-kind');
  return kind === 'custom' || kind === 'matched' ? kind : null;
}

/**
 * Whether `actor`'s device offers to seek an opponent: finding an opponent's
 * command, or the game's choices saying finding an opponent offers seeking.
 */
export async function seekOpponentOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  if (await ui.get(SEEK).isVisible()) return true;
  const offer = ui.get(FIND_OPPONENT_OFFER);
  return (
    (await offer.isVisible()) &&
    (await offer.attribute('data-offer')) === 'seek'
  );
}

/** `actor` returns to their unfinished game from the offer their device shows. */
export const returnToGame = scenarioAction({
  name: 'returnToGame',
  act: async (s, actor: string) => {
    await bringToFront(s, actor);
    await (await actorUi(s, actor)).get(RETURN_TO_GAME_GO).tap();
    await s.session.waitForIdle();
  },
});

/**
 * `actor` returns to their unfinished game when their device offers it,
 * and otherwise stays where they are (already on its board).
 */
export const returnToGameIfOffered = scenarioAction({
  name: 'returnToGameIfOffered',
  act: async (s, actor: string) => {
    if ((await returnToGameOffered(s, actor)) === null) return;
    await Promise.resolve(returnToGame.act(s, actor));
  },
});
