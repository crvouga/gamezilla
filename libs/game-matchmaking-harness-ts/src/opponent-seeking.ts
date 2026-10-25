import {
  defaultMatchChoice,
  matchChoiceOf,
} from '@libs/game-matchmaking-shared-ts/match-choice';
import { timeControlKey } from '@libs/game-matchmaking-shared-ts/time-control';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from './multiplayer-commands';
import { multiplayerView } from './multiplayer-reads';
import { clockChoiceOf, requestGameOpponent } from './multiplayer-search-ui';
import { multiplayerSpaceId } from './multiplayer-spaces';

/**
 * `actor` seeks an opponent for `gameId` from their own space, through the
 * game's shared choices, whichever game it is, at `clockChoice` as finding an
 * opponent offers it (with or without the game's clock namespace; the
 * screen's default choice unless named).
 */
export const seekGameOpponent = scenarioAction({
  name: 'seekGameOpponent',
  act: async (s, actor: string, gameId: string, clockChoice?: string) => {
    await Promise.resolve(signInWithGoogle.act(s, actor));
    await Promise.resolve(backToTabs.act(s, actor));
    await Promise.resolve(createSpace.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui.get(Handles.gameMenu(gameId)).tap();
    await ui.get(Handles.gameChoice('multiplayer')).tap();
    const matched = s.harness.composition.app.turnGames.capability(
      gameId,
      'matchmaking'
    );
    if (matched === undefined)
      throw new Error(`${gameId} offers no finding an opponent`);
    await Promise.resolve(
      requestGameOpponent.act(
        s,
        actor,
        clockChoice ?? defaultMatchChoice(matched)
      )
    );
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

/** Every handle {@link findingAnOpponentStep} reads, in the order it reads them. */
export function findingAnOpponentHandles(gameId: string): readonly string[] {
  return [
    ...FINDING_SURFACES,
    ...NOWHERE_TO_FIND,
    Handles.gameChoice('multiplayer'),
    Handles.gameMenu(gameId),
    Handles.navBack,
  ];
}

/**
 * The next step towards finding an opponent for `gameId`, from the handles
 * on screen: `arrived` once it (or, `whereverItCan`, an ended or missing
 * space) shows, `nowhere` for an ended or missing space otherwise, the way in
 * to tap, or `null` while nothing is shown yet. An ended or missing space
 * also shows Back, but that Back leaves the space and is never a way in.
 */
export function findingAnOpponentStep(
  visible: ReadonlySet<string>,
  gameId: string,
  whereverItCan: boolean
): 'arrived' | 'nowhere' | string | null {
  if (FINDING_SURFACES.some((surface) => visible.has(surface)))
    return 'arrived';
  if (NOWHERE_TO_FIND.some((surface) => visible.has(surface)))
    return whereverItCan ? 'arrived' : 'nowhere';
  return (
    [
      Handles.gameChoice('multiplayer'),
      Handles.gameMenu(gameId),
      Handles.navBack,
    ].find((way) => visible.has(way)) ?? null
  );
}

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
  await pollUntil(
    s,
    async () => {
      await bringToFront(s, actor);
      const visible = new Set<string>();
      for (const handle of findingAnOpponentHandles(gameId))
        if (await ui.get(handle).isVisible()) visible.add(handle);
      const step = findingAnOpponentStep(visible, gameId, whereverItCan);
      if (step === 'arrived') return true;
      if (step === 'nowhere')
        throw new Error(`${actor}'s space has no finding an opponent left`);
      if (step !== null) await ui.get(step).tap();
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

/** Choose the clock choice and find, or send what a stale screen would. */
async function seekFromFindingAnOpponent(
  s: ProductHarness,
  actor: string,
  gameId: string,
  timeControl: string
) {
  await reachFindingAnOpponent(s, actor, gameId, true);
  const ui = await actorUi(s, actor);
  if (await ui.get('multiplayer-access-denial').isVisible()) return;
  const choice = ui.get(
    `multiplayer-time-control-${timeControlKey(clockChoiceOf(timeControl))}`
  );
  if (
    matchChoiceOf(timeControl)?.clock === null &&
    (await ui.get('multiplayer-find').isVisible())
  ) {
    await forgetMultiplayerReply(s, actor);
    await ui.get('multiplayer-find').tap();
    await s.session.waitForIdle();
    return;
  }
  if (!(await choice.isVisible())) {
    await Promise.resolve(
      sendMultiplayerCommand.act(s, actor, {
        name: 'findChessOpponent',
        args: { timeControl, requestId: s.session.ports.createId() },
      })
    );
    return;
  }
  await forgetMultiplayerReply(s, actor);
  await choice.tap();
  await ui.get('multiplayer-find').tap();
  await s.session.waitForIdle();
}

/**
 * `actor` seeks an opponent for `gameId` at `timeControl` (in the game's
 * clock namespace) from finding an opponent in their space — an account
 * without one starts it, as seeking from the game's choices does — opened as
 * far as their device can: they choose the clock choice and find. A screen
 * that cannot express
 * the request — a clock choice it does not offer, or a search, matched game
 * or custom game already under way — sends the same command a stale screen
 * on another device would; a sign-in invitation takes no command at all.
 */
export const findGameOpponent = scenarioAction({
  name: 'findGameOpponent',
  act: async (s, actor: string, gameId: string, timeControl: string) => {
    await ensureActor(s, actor);
    if (
      (await multiplayerSpaceId(s, actor)) === null &&
      (await signedInAccountOf(s, actor)) !== null
    )
      await Promise.resolve(createSpace.act(s, actor));
    await seekFromFindingAnOpponent(s, actor, gameId, timeControl);
  },
});

/**
 * `actor`, who left every space they were in, seeks an opponent for
 * `gameId` at `timeControl` without starting a space: their stale screen
 * sends the command, and whether they may seek from no space is decided
 * by the refusal.
 */
export const findGameOpponentOutsideSpaces = scenarioAction({
  name: 'findGameOpponentOutsideSpaces',
  act: async (s, actor: string, gameId: string, timeControl: string) => {
    await ensureActor(s, actor);
    await seekFromFindingAnOpponent(s, actor, gameId, timeControl);
  },
});

/**
 * `actor` stops seeking from the shared waiting controls. A screen showing
 * no search to stop, such as the matched game it became, sends the same
 * command a stale screen would, for the search the device last held.
 */
export const stopSeekingOpponent = scenarioAction({
  name: 'stopSeekingOpponent',
  act: async (s, actor: string) => {
    const stop = (await actorUi(s, actor)).get('multiplayer-stop');
    if (await stop.isVisible()) {
      await forgetMultiplayerReply(s, actor);
      await stop.tap();
      return;
    }
    const { search } = await multiplayerView(s, actor);
    await Promise.resolve(
      sendMultiplayerCommand.act(s, actor, {
        name: 'stopFindingChessOpponent',
        args: {
          searchId: search?.search_id ?? 'no-search',
          requestId: s.session.ports.createId(),
        },
      })
    );
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
  findGameOpponent,
  findGameOpponentOutsideSpaces,
  givenGameSpace,
  openFindingAnOpponent,
  stopSeekingOpponent,
];
