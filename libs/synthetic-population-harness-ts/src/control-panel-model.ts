/**
 * The control panels as the model sees them: Alice acts on her phone and
 * follows the Synthetic Population panel on her tablet; Cedar and Maple are
 * Synthetic Users, each with a person to play a matched game against.
 */

import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { givenMultiplayerPosition } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import {
  awaitGameMatch,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { grantOperatorPermissions } from '@libs/observatory-actions-harness-ts/operator-access-actions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { showSpacesTab } from '@libs/spaces-harness-ts/space-ui';
import { configureUsername } from '@libs/synthetic-population-behavior-shared-ts/application-actions';
import { SyntheticUserApplication } from '@libs/synthetic-population-behavior-shared-ts/synthetic-user-application';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  directoryControlPanelOffered,
  directoryRowShown,
} from './control-panel-actions';
import { openSyntheticPopulationPanel } from './observatory-actions';
import {
  givenSyntheticGameSpace,
  openSyntheticGame,
  syntheticGame,
  syntheticGameView,
} from './synthetic-game-actions';
import { syntheticUserActor } from './synthetic-sign-in-actions';
import { givenSyntheticUser } from './synthetic-user-fixtures';

/** Alice's devices: her phone controls, her tablet follows the panel. */
export const ALICE_CONTROL = 'alice';
export const ALICE_LIST = 'alice:tablet';
/** Who each Synthetic User plays its matched games against. */
const OPPONENT: Record<string, string> = { Cedar: 'bob', Maple: 'carol' };
const SYNTHETIC_USERS = ['Cedar', 'Maple'] as const;
const READY_MS = 15_000;

/** Alice may control; Cedar and Maple are available; her tablet follows them. */
export const givenControlPanels = scenarioAction({
  name: 'givenControlPanels',
  act: async (s) => {
    for (const name of SYNTHETIC_USERS)
      await Promise.resolve(givenSyntheticUser.act(s, name, false));
    await Promise.resolve(signInWithGoogle.act(s, ALICE_CONTROL));
    await Promise.resolve(
      grantOperatorPermissions.act(s, ALICE_CONTROL, [
        PERMISSION.syntheticPopulationView,
        PERMISSION.syntheticPopulationInspect,
        PERMISSION.syntheticPopulationControl,
      ])
    );
    await Promise.resolve(
      signInWithGoogleAsAccount.act(s, ALICE_LIST, ALICE_CONTROL)
    );
    await Promise.resolve(openSyntheticPopulationPanel.act(s, ALICE_LIST));
  },
});

/** Alice opens the Synthetic Population panel on the device that follows it. */
export const openControlPanels = scenarioAction({
  name: 'openControlPanels',
  act: async (s) => {
    await Promise.resolve(openSyntheticPopulationPanel.act(s, ALICE_LIST));
    await s.session.waitForIdle();
  },
});

/** A short known position, so the game reaches its result quickly. */
async function shortPosition(
  s: ProductHarness,
  actor: string,
  label: string,
  gameId: string
): Promise<void> {
  const game = syntheticGame(label);
  if (!isTurnHarnessGame(game)) return;
  const victory = game.fixtures.firstSideVictory;
  const fen = game.shared.turnGame.rules.replay(victory, victory.length - 1);
  await Promise.resolve(
    givenMultiplayerPosition.act(s, actor, { gameId, fen })
  );
}

/**
 * Into a space to look for the game from: the one the player already hosts,
 * since a second is refused at the hosting limit, or else a new one.
 */
async function enterGameSpace(
  s: ProductHarness,
  player: string,
  label: string
): Promise<void> {
  await Promise.resolve(backToTabs.act(s, player));
  await showSpacesTab(s, player);
  const hosting = await (await actorUi(s, player))
    .get(Handles.spaceCard(player))
    .isVisible();
  await Promise.resolve(
    hosting
      ? openSyntheticGame.act(s, player, label)
      : givenSyntheticGameSpace.act(s, player, label)
  );
}

/**
 * The Synthetic User starts its next activity: a matched game against its
 * opponent, both looking for one with the game's usual choice.
 */
export const startSyntheticGame = scenarioAction({
  name: 'startSyntheticGame',
  act: async (s, name: string, label: string) => {
    const actor = syntheticUserActor(name);
    const person = OPPONENT[name]!;
    const matched = syntheticGame(label).shared.capabilities.matchmaking;
    if (matched === undefined)
      throw new Error(`${label} offers no matchmaking`);
    await Promise.resolve(signInWithGoogle.act(s, person));
    // After an earlier matched game the person is still in its space, where
    // neither the tab bar nor a back button is offered: leave it first.
    await Promise.resolve(backToTabs.act(s, person));
    await configureUsername(await actorUi(s, person), person);
    for (const player of [actor, person]) {
      await enterGameSpace(s, player, label);
      await Promise.resolve(
        givenOpponentSearch.act(s, player, defaultMatchChoice(matched))
      );
    }
    await Promise.resolve(awaitGameMatch.act(s, actor, person, true));
    await Promise.resolve(openSyntheticGame.act(s, actor, label));
    const gameId = await pollUntil(
      s,
      async () => (await syntheticGameView(s, actor)).gameId,
      { maxMs: READY_MS, description: `${name} sees its matched game` }
    );
    await shortPosition(s, actor, label, gameId);
    await Promise.resolve(openSyntheticGame.act(s, actor, label));
  },
});

/** The Synthetic User plays its ongoing game on to its result. */
export const finishSyntheticGame = scenarioAction({
  name: 'finishSyntheticGame',
  act: async (s, name: string) => {
    const actor = syntheticUserActor(name);
    await bringToFront(s, actor);
    const application = new SyntheticUserApplication(await actorUi(s, actor), {
      games: GAME_AUTOMATIONS,
      clock: s.harness.clock,
      random: s.session.ports.random,
      username: actor,
      emit: () => undefined,
    });
    application.authenticated();
    try {
      await pollUntil(
        s,
        async () => {
          await application.continueCurrentGame();
          const game = await syntheticGameView(s, actor);
          return game.outcome !== null && game.outcome !== 'ongoing'
            ? true
            : null;
        },
        { maxMs: 180_000, description: `${name} plays to a result` }
      );
    } finally {
      application.close();
    }
  },
});

/** Alice's devices lose, or regain, their connection. */
export const setAliceConnection = scenarioAction({
  name: 'setAliceConnection',
  act: async (s, online: boolean) => {
    for (const device of [ALICE_CONTROL, ALICE_LIST])
      await Promise.resolve(
        online
          ? restoreActorConnection.act(s, device)
          : partition.act(s, device)
      );
    await s.session.waitForIdle();
  },
});

/**
 * What Alice and the Synthetic Users see: who her panel shows as paused and
 * offers a control panel for, and who is in an ongoing game on its own
 * screen.
 */
export async function observeControlPanels(s: ProductHarness) {
  const paused: string[] = [];
  const offered: string[] = [];
  const playing: string[] = [];
  for (const name of SYNTHETIC_USERS) {
    const row = await directoryRowShown(s, ALICE_LIST, name);
    if (row?.includes('Paused') === true) paused.push(name);
    if (await directoryControlPanelOffered(s, ALICE_LIST, name))
      offered.push(name);
    const board = await syntheticGameView(s, syntheticUserActor(name));
    if (board.outcome === 'ongoing') playing.push(name);
  }
  return { paused, playing, controlPanelOffered: offered };
}
