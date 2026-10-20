import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

/** What each shared screen shows first, so a person can tell it is open. */
export const SHARED_SCREEN_MARK = {
  'custom-game': 'custom-game-status',
  multiplayer: 'multiplayer-find',
  history: 'game-history-statistics',
} as const;

export type SharedGameScreen = keyof typeof SHARED_SCREEN_MARK;

/** The shared choices every game offers, by the screen each opens. */
export const SHARED_GAME_CHOICES: readonly SharedGameScreen[] = [
  'custom-game',
  'multiplayer',
  'history',
];

/** The host picks `gameId` for the space from the game choice. */
export const pickGame = scenarioAction({
  name: 'pickGame',
  act: async (s, actor: string, gameId: string) => {
    const ui = await actorUi(s, actor);
    await bringToFront(s, actor);
    await ui.get(Handles.gameMenu(gameId)).expect.visible();
    await ui.get(Handles.gameMenu(gameId)).tap();
    await ui.get(Handles.gameChoices).expect.visible();
  },
});

/** Open one of the selected game's choices, as anyone in the space can. */
export const openGameChoice = scenarioAction({
  name: 'openGameChoice',
  act: async (s, actor: string, screen: string) => {
    const ui = await actorUi(s, actor);
    await bringToFront(s, actor);
    await ui.get(Handles.gameChoice(screen)).expect.visible();
    await ui.get(Handles.gameChoice(screen)).tap();
  },
});

/** Go back from a game's screen, as the chrome's back control does. */
export const goBackInGame = scenarioAction({
  name: 'goBackInGame',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await bringToFront(s, actor);
    await ui.get(Handles.navBack).tap();
  },
});

/** The puzzle choices a game offering puzzles adds, by the screen each opens. */
export const PUZZLE_GAME_CHOICES = ['puzzle', 'stats'] as const;

export type GameChoiceScreen =
  | SharedGameScreen
  | (typeof PUZZLE_GAME_CHOICES)[number];

/** Which of the platform's choices `actor` is offered right now, in order. */
export async function offeredGameChoices(
  s: ProductHarness,
  actor: string
): Promise<readonly GameChoiceScreen[]> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const offered: GameChoiceScreen[] = [];
  for (const screen of [...SHARED_GAME_CHOICES, ...PUZZLE_GAME_CHOICES])
    if (await ui.get(Handles.gameChoice(screen)).isVisible())
      offered.push(screen);
  return offered;
}

/** Whether `actor` is shown the shared `screen` (or the choices, `null`). */
export async function showsGameScreen(
  s: ProductHarness,
  actor: string,
  screen: SharedGameScreen | null
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui
    .get(screen === null ? Handles.gameChoices : SHARED_SCREEN_MARK[screen])
    .isVisible();
}

/**
 * Bring `actor` to the selected game's custom games: the space may already
 * show them, else the host picks the game and anyone opens the choice.
 */
export async function showCustomGames(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  await pollUntil(
    s,
    async () => {
      await bringToFront(s, actor);
      if (await ui.get(SHARED_SCREEN_MARK['custom-game']).isVisible())
        return true;
      if (await ui.get(Handles.gameChoice('custom-game')).isVisible())
        await ui.get(Handles.gameChoice('custom-game')).tap();
      else if (await ui.get(Handles.gameMenu(gameId)).isVisible())
        await ui.get(Handles.gameMenu(gameId)).tap();
      return null;
    },
    { maxMs: 15_000, stepMs: 1, description: `${actor} reaches custom games` }
  );
}

/**
 * Wait until `actor` is shown somewhere to play `gameId` in the space — the
 * game choice, its shared choices or its custom games — or is told the host
 * is offline instead.
 */
export async function waitCustomGameAvailability(
  s: ProductHarness,
  actor: string,
  gameId: string
): Promise<'available' | 'host offline'> {
  const ui = await actorUi(s, actor);
  return pollUntil(
    s,
    async () => {
      if (await ui.get(Handles.spaceHostOffline).isVisible())
        return 'host offline';
      for (const handle of [
        Handles.gameMenu(gameId),
        Handles.gameChoice('custom-game'),
        SHARED_SCREEN_MARK['custom-game'],
      ]) {
        if (await ui.get(handle).isVisible()) return 'available';
      }
      return null;
    },
    {
      maxMs: 15_000,
      stepMs: 1,
      description: 'space play choices or host availability',
    }
  );
}

/** `actor` opens the selected game's custom games, as {@link showCustomGames}. */
export const openCustomGames = scenarioAction({
  name: 'openCustomGames',
  act: showCustomGames,
});

/** The host takes the space from its current game to `gameId`'s custom games. */
export const switchSpaceGame = scenarioAction({
  name: 'switchSpaceGame',
  act: async (s, host: string, gameId: string) => {
    const ui = await actorUi(s, host);
    await pollUntil(
      s,
      async () => {
        await bringToFront(s, host);
        if (await ui.get(Handles.gameMenu(gameId)).isVisible()) return true;
        await ui.get(Handles.navBack).tap();
        return null;
      },
      {
        maxMs: 15_000,
        stepMs: 1,
        description: `${host} reaches the game choice`,
      }
    );
    await showCustomGames(s, host, gameId);
  },
});

export const GAME_NAVIGATION_ACTIONS = [
  pickGame,
  openGameChoice,
  goBackInGame,
  openCustomGames,
  switchSpaceGame,
];
