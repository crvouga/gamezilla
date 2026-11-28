/**
 * Choosing what a space plays, whichever game it is, including the attempts
 * that do not land: the game is not offered, the person is not the host, or
 * the device has no connection. What a device shows is its space view: the
 * space's game choice, or the game's choices once the host picks the game.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { gameTile } from '@libs/harness-ts/game-tiles';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront, visible } from '@libs/harness-ts/observations';
import { SPACE_WAIT_MS, waitForOneOf } from '@libs/spaces-harness-ts/space-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { showGameSessionHome } from './game-session-places';

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
  if (await visible(s, actor, [gameTile(s, gameId)])) return 'choice';
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
  return visible(s, actor, [gameTile(s, gameId)]);
}

/** Whether `actor` is offered to go back to the game choice. */
export function goBackToGameChoiceOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return visible(s, actor, [GAME_CHOICES]);
}

/** A game session's screen, which the space may be held on. */
const GAME_SESSION = 'game-session-content';

/**
 * Wait until `actor`'s space shows the game choice, the game's choices or a
 * game session.
 */
function spaceShown(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<string> {
  return waitForOneOf(
    s,
    actor,
    [gameTile(s, gameId), GAME_CHOICES, GAME_SESSION],
    'the space view'
  );
}

/** Behind the game's choices a screen is at most this many Backs deep. */
const DEEPEST_SCREEN = 4;

/**
 * From one of the game's screens, Back a step at a time until its choices
 * show. Whether they do: no Back is offered while a game session under way
 * holds the space on its board.
 */
async function backToGameChoices(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  for (let step = 0; step < DEEPEST_SCREEN; step += 1) {
    if (await ui.get(GAME_CHOICES).isVisible()) return true;
    if (await ui.get('game-back-stay').isVisible()) {
      await ui.get('game-back-stay').tap();
      return false;
    }
    if (await ui.get('multiplayer-open-commands').isVisible()) {
      await ui.get('multiplayer-open-commands').tap();
      if (await ui.get('multiplayer-browse-games').isVisible()) {
        await ui.get('multiplayer-browse-games').tap();
        await s.session.waitForIdle();
        continue;
      }
    }
    if (await ui.get(GAME_SESSION).isVisible())
      await showGameSessionHome(s, actor);
    if (!(await ui.get(Handles.navBack).isVisible())) return false;
    await ui.get(Handles.navBack).tap();
    await s.session.waitForIdle();
  }
  return ui.get(GAME_CHOICES).isVisible();
}

/**
 * `actor` tries to pick `gameId` for the space: when the game choice offers
 * it, they pick it and wait for the game's choices or why not.
 */
export const attemptPickGame = scenarioAction({
  name: 'attemptPickGame',
  act: async (s, actor: string, gameId: string) => {
    await bringToFront(s, actor);
    if ((await spaceShown(s, actor, gameId)) !== gameTile(s, gameId)) return;
    const ui = await actorUi(s, actor);
    await ui.get(gameTile(s, gameId)).tap({ timeoutMs: SPACE_WAIT_MS });
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
 * `actor` tries to go back from the game's choices to the game choice: from
 * another of the game's screens they first go back to its choices, as far
 * as Back is offered; then they go back and wait for the game choice or why
 * not.
 */
export const attemptGoBackToGameChoice = scenarioAction({
  name: 'attemptGoBackToGameChoice',
  act: async (s, actor: string, gameId: string) => {
    await bringToFront(s, actor);
    const shown = await waitForOneOf(
      s,
      actor,
      [gameTile(s, gameId), GAME_CHOICES, GAME_SESSION, Handles.navBack],
      'the space view'
    );
    if (shown === gameTile(s, gameId)) return;
    if (!(await backToGameChoices(s, actor))) return;
    const ui = await actorUi(s, actor);
    await ui.get(Handles.navBack).tap();
    await waitForOneOf(
      s,
      actor,
      [
        gameTile(s, gameId),
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
