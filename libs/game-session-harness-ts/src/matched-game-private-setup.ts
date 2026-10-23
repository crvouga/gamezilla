/**
 * A person's own private setup in a matched game of a game that has one: as
 * they arrange it on the setup board of their matched game, choose it (once,
 * for good) through the same client mutation boundary as the screen, and as
 * their screen and device show it. A change the screen no longer takes (the
 * setup is chosen) is the choice a modified device would send again, so its
 * refusal is the product's.
 */

import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { openFindingAnOpponentIfAny } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorLocalSql, signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { controlIsEnabled } from '@pkgs/ui-testing-root-shared-ts/control-is-enabled';
import { harnessGameAt } from './harness-game-of';

/** The setup board of a matched game. */
export const MATCHED_GAME_SETUP_BOARD = 'multiplayer-setup';
const CHOOSE = 'multiplayer-setup-choose';

const arranged = new WeakMap<ProductHarness, Map<string, string>>();

/** `actor`'s matched game, brought to the front of their device. */
async function matchedGameShown(s: ProductHarness, actor: string) {
  const game = (await multiplayerView(s, actor)).game;
  if (game === null) throw new Error(`${actor} has no matched game`);
  const played = harnessGameAt(s, game.fen);
  await Promise.resolve(
    openFindingAnOpponentIfAny.act(s, actor, played.shared.id)
  );
  await bringToFront(s, actor);
  return { game, played, ui: await actorUi(s, actor) };
}

async function arrangeOnBoard(
  s: ProductHarness,
  actor: string,
  setup: string
): Promise<void> {
  const { game, played, ui } = await matchedGameShown(s, actor);
  const arrange = played.shared.automation.arrange;
  if (arrange === undefined)
    throw new Error(`${played.label} has no setup board gesture`);
  await arrange(ui, MATCHED_GAME_SETUP_BOARD, setup);
  const people = arranged.get(s) ?? new Map<string, string>();
  people.set(`${game.id}:${actor}`, setup);
  arranged.set(s, people);
}

async function sendSetupChoice(
  s: ProductHarness,
  actor: string,
  gameId: string,
  setup: string
): Promise<void> {
  await Promise.resolve(
    sendMultiplayerCommand.act(s, actor, {
      name: 'chooseMultiplayerSetup',
      args: { gameId, setup, requestId: s.session.ports.createId() },
    })
  );
}

/**
 * `actor` arranges `setup` on the setup board of their matched game
 * (`null`: nothing, so it stays incomplete).
 */
export const arrangeMatchedPrivateSetup = scenarioAction({
  name: 'arrangeMatchedPrivateSetup',
  act: async (s, actor: string, setup: string | null) => {
    if (setup === null) {
      await matchedGameShown(s, actor);
      return;
    }
    await arrangeOnBoard(s, actor, setup);
  },
});

/**
 * `actor` chooses the private setup on their board, as its choose control
 * sends it. A control the screen disables (the setup is incomplete) sends
 * nothing, and no earlier verdict speaks for it.
 */
export const chooseMatchedPrivateSetup = scenarioAction({
  name: 'chooseMatchedPrivateSetup',
  act: async (s, actor: string) => {
    const { game, ui } = await matchedGameShown(s, actor);
    const control = ui.get(CHOOSE);
    const setup = arranged.get(s)?.get(`${game.id}:${actor}`);
    if (
      setup === undefined ||
      !(await control.isVisible()) ||
      !controlIsEnabled(
        await control.attribute('disabled'),
        await control.attribute('aria-disabled')
      )
    ) {
      forgetMultiplayerReply(s, actor);
      return;
    }
    await sendSetupChoice(s, actor, game.id, setup);
  },
});

const RANDOM = 'multiplayer-setup-random';

/**
 * Whether `actor`'s setup board takes a new arrangement now: it is shown
 * while they are still choosing, and holds still (its random setup control
 * disabled with it) while their device has no connection.
 */
export async function matchedSetupBoardTakes(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const random = ui.get(RANDOM);
  return (
    (await ui.get(MATCHED_GAME_SETUP_BOARD).isVisible()) &&
    (await random.isVisible()) &&
    controlIsEnabled(
      await random.attribute('disabled'),
      await random.attribute('aria-disabled')
    )
  );
}

/**
 * `actor` changes their private setup to `setup`: on the setup board while
 * it takes one, otherwise as the choice a modified device sends.
 */
export const changeMatchedPrivateSetup = scenarioAction({
  name: 'changeMatchedPrivateSetup',
  act: async (s, actor: string, setup: string) => {
    const { game } = await matchedGameShown(s, actor);
    if (await matchedSetupBoardTakes(s, actor)) {
      await arrangeOnBoard(s, actor, setup);
      return;
    }
    await sendSetupChoice(s, actor, game.id, setup);
  },
});

/**
 * `actor` brings their matched game to the front: a person playing it opens
 * it; a watcher already has it in front of them.
 */
export const showMatchedGame = scenarioAction({
  name: 'showMatchedGame',
  act: async (s, actor: string) => {
    if ((await multiplayerView(s, actor)).game !== null)
      await matchedGameShown(s, actor);
    await bringToFront(s, actor);
  },
});

/** What `actor` is told of their own private setup, if anything. */
export async function matchedPrivateSetupStatus(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const status = ui.get('multiplayer-setup-status');
  return (await status.isVisible()) ? ((await status.text()) ?? '') : null;
}

/**
 * Whether `actor`'s screen shows `side` ready (`Ready`) or still choosing
 * (`Getting ready`); `null` when it shows neither.
 */
export async function matchedSideReadinessShown(
  s: ProductHarness,
  actor: string,
  side: 'white' | 'black'
): Promise<boolean | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const shown = ui.get(`multiplayer-setup-readiness-${side}`);
  if (!(await shown.isVisible())) return null;
  const text = (await shown.text()) ?? '';
  if (text.includes('Getting ready')) return false;
  return text.includes('Ready') ? true : null;
}

/** The private setup `actor`'s device holds as their own in their matched game. */
export async function ownMatchedPrivateSetup(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const db = actorLocalSql(s, actor);
  const owner = await signedInAccountOf(s, actor);
  const game = (await multiplayerView(s, actor)).game;
  if (db === null || owner === null || game === null) return null;
  const rows = await db.query(sql<{ setup: string }>`SELECT setup
    FROM chess_multiplayer_setups
    WHERE game_id = ${game.id} AND owner_id = ${owner} AND deleted_at IS NULL`);
  return rows[0]?.setup ?? null;
}
