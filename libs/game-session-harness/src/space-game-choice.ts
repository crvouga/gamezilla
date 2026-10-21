/**
 * Choosing what a space plays, whichever game it is, including the attempts
 * that do not land: the game is not offered, the person is not the host, or
 * the device has no connection. What a device shows is its space view: the
 * space's game choice, or the game's choices once the host picks the game.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront, visible } from '@libs/harness/observations';
import { SPACE_WAIT_MS, waitForOneOf } from '@libs/spaces-harness/space-ui';
import { Handles } from '@libs/test-ids-shared/handles';

/** The menu itself identifies the selected game, independent of its choices. */
const GAME_CHOICES = Handles.gameChoices;

/** What a device in a space shows: the space view. */
export type SpaceView = 'choice' | 'game' | 'host offline' | 'elsewhere';

/**
 * `actor`'s space view for `gameId`: told the host is offline, the game's
 * choices (`game`), the space's game choice (`choice`), or neither.
 */
export async function readSpaceView(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<SpaceView> {
  await bringToFront(s, actor);
  if (await visible(s, actor, [Handles.spaceHostOffline]))
    return 'host offline';
  if (await visible(s, actor, [GAME_CHOICES])) return 'game';
  if (await visible(s, actor, [Handles.gameMenu(gameId)])) return 'choice';
  return 'elsewhere';
}

/** Whether `actor` is told that only the host chooses the game. */
export function hostChoosesGameShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return visible(s, actor, [Handles.spaceHostChoosesGame]);
}

/** Whether `actor` is offered to pick `gameId` for the space. */
export function pickGameOffered(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<boolean> {
  return visible(s, actor, [Handles.gameMenu(gameId)]);
}

/** Whether `actor` is offered to go back to the game choice. */
export function goBackToGameChoiceOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return visible(s, actor, [GAME_CHOICES]);
}

/** Wait until `actor`'s space shows the game choice or the game's choices. */
function spaceShown(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<string> {
  return waitForOneOf(
    s,
    actor,
    [Handles.gameMenu(gameId), GAME_CHOICES],
    'the space view'
  );
}

/**
 * `actor` tries to pick `gameId` for the space: when the game choice offers
 * it, they pick it and wait for the game's choices or why not.
 */
export const attemptPickGame = scenarioAction({
  name: 'attemptPickGame',
  act: async (s, actor: string, gameId: string) => {
    await bringToFront(s, actor);
    if ((await spaceShown(s, actor, gameId)) !== Handles.gameMenu(gameId))
      return;
    const ui = await actorUi(s, actor);
    await ui.get(Handles.gameMenu(gameId)).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitForOneOf(
      s,
      actor,
      [
        GAME_CHOICES,
        Handles.spaceHostChoosesGame,
        Handles.statusConnectionMissing,
      ],
      'the game, or why not'
    );
  },
});

/**
 * `actor` tries to go back from the game's choices to the game choice: when
 * the space shows the game's choices, they go back and wait for the game
 * choice or why not.
 */
export const attemptGoBackToGameChoice = scenarioAction({
  name: 'attemptGoBackToGameChoice',
  act: async (s, actor: string, gameId: string) => {
    await bringToFront(s, actor);
    if ((await spaceShown(s, actor, gameId)) !== GAME_CHOICES) return;
    const ui = await actorUi(s, actor);
    await ui.get(Handles.navBack).tap();
    await waitForOneOf(
      s,
      actor,
      [
        Handles.gameMenu(gameId),
        Handles.spaceHostChoosesGame,
        Handles.statusConnectionMissing,
      ],
      'the game choice, or why not'
    );
  },
});

export const SPACE_GAME_CHOICE_ACTIONS = [
  attemptPickGame,
  attemptGoBackToGameChoice,
];
