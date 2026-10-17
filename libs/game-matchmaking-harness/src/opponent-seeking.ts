import { DEFAULT_TIME_CONTROL } from '@libs/game-matchmaking-shared/time-control';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { backToTabs } from '@libs/harness/shell-actions';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import { multiplayerView } from './multiplayer-reads';
import { requestGameOpponent } from './multiplayer-search-ui';
import { multiplayerSpaceId } from './multiplayer-spaces';

/**
 * `actor` seeks an opponent for `gameId` from their own space, through the
 * game's shared choices, whichever game it is.
 */
export const seekGameOpponent = scenarioAction({
  name: 'seekGameOpponent',
  act: async (
    s,
    actor: string,
    gameId: string,
    timeControl: string = DEFAULT_TIME_CONTROL
  ) => {
    await Promise.resolve(signInWithGoogle.act(s, actor));
    await Promise.resolve(backToTabs.act(s, actor));
    await Promise.resolve(createSpace.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui.get(Handles.gameMenu(gameId)).tap();
    await ui.get(Handles.gameChoice('multiplayer')).tap();
    await Promise.resolve(requestGameOpponent.act(s, actor, timeControl));
  },
});

/**
 * Given setup: `actor`'s space to seek an opponent from, open on their
 * device; a person without one starts it.
 */
export const givenGameSpace = scenarioAction({
  name: 'givenGameSpace',
  act: async (s, actor: string) => {
    const id = await multiplayerSpaceId(s, actor);
    if (id === null) await Promise.resolve(createSpace.act(s, actor));
    else await s.actors.get(actor)!.openLink(`/space/${id}`);
  },
});

/** What finding an opponent shows first: a game, a search, or the choices. */
const FINDING_SURFACES = [
  'multiplayer-game',
  'multiplayer-waiting',
  'multiplayer-find',
  'multiplayer-access-denial',
  'multiplayer-unavailable',
] as const;

/** Where a device can show no finding an opponent at all. */
const NOWHERE_TO_FIND = [Handles.spaceEnded, Handles.spaceNotFound] as const;

async function reachFindingAnOpponent(
  s: ProductHarness,
  actor: string,
  gameId: string,
  whereverItCan: boolean
): Promise<void> {
  await ensureActor(s, actor);
  const spaceId = await multiplayerSpaceId(s, actor);
  if (spaceId === null) {
    if (whereverItCan) return;
    throw new Error(`${actor} has no space to play in`);
  }
  const device = s.actors.get(actor)!;
  if (!(await device.currentPath()).includes(spaceId))
    await device.openLink(`/space/${spaceId}`);
  await s.session.waitForIdle();
  const ui = await actorUi(s, actor);
  const arrived = whereverItCan
    ? [...FINDING_SURFACES, ...NOWHERE_TO_FIND]
    : FINDING_SURFACES;
  await pollUntil(
    s,
    async () => {
      await bringToFront(s, actor);
      for (const surface of arrived)
        if (await ui.get(surface).isVisible()) return true;
      for (const way of [
        Handles.gameChoice('multiplayer'),
        Handles.gameMenu(gameId),
        Handles.navBack,
      ])
        if (await ui.get(way).isVisible()) {
          await ui.get(way).tap();
          return null;
        }
      return null;
    },
    {
      maxMs: 15_000,
      stepMs: 1,
      description: `${actor} opens finding an opponent`,
    }
  );
}

/**
 * `actor` opens finding an opponent for `gameId` in their space, from
 * wherever their device is: back to the game's choices, the game picked
 * when the space has not picked one yet, then the choice itself.
 */
export const openFindingAnOpponent = scenarioAction({
  name: 'openFindingAnOpponent',
  act: (s, actor: string, gameId: string) =>
    reachFindingAnOpponent(s, actor, gameId, false),
});

/**
 * `actor` opens finding an opponent for `gameId` as far as their device
 * can: nothing without a space to play in, and a space that has ended or is
 * gone shows only that. A model's person may try it on any device.
 */
export const openFindingAnOpponentIfAny = scenarioAction({
  name: 'openFindingAnOpponentIfAny',
  act: (s, actor: string, gameId: string) =>
    reachFindingAnOpponent(s, actor, gameId, true),
});

/** `actor` stops seeking from the shared waiting controls. */
export const stopSeekingOpponent = scenarioAction({
  name: 'stopSeekingOpponent',
  act: async (s, actor: string) => {
    await (await actorUi(s, actor)).get('multiplayer-stop').tap();
  },
});

/** What `actor` sees of their wait and the game an opponent brings. */
export async function opponentSearchView(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  return {
    ...(await multiplayerView(s, actor)),
    waiting: await ui.get('multiplayer-waiting').isVisible(),
    board: await ui.get(Handles.multiplayerBoard).isVisible(),
  };
}

export const OPPONENT_SEEKING_ACTIONS = [
  seekGameOpponent,
  givenGameSpace,
  openFindingAnOpponent,
  stopSeekingOpponent,
];
