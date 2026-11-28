/**
 * A person's own private setup in a game session of a game that has one, as
 * they arrange it on the game's own setup board and as their screen shows
 * it. A change reaches the space only with readiness, so a change the board
 * no longer takes (the person is ready, or the game has started) is the
 * readiness a modified device would send, and its refusal is the product's.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { openGameSessionPlace } from './game-session-places';
import { readGameSessionProbe } from './game-session-probe';
import { gameSessionReference, sendGameSessionChoice } from './game-session-ui';
import type { TurnHarnessGame } from './harness-game';
import { turnHarnessGameAt } from './harness-game-of';
import { keepOwnPrivateSetup } from './own-private-setups';

/** The setup board of the Game Session screen. */
export const GAME_SESSION_SETUP_BOARD = 'game-session-setup';

/** The lobby's row that opens the person's private setup. */
export const GAME_SESSION_SETUP_ROW = 'game-session-setup-open';

/** `actor` opens their private setup's own place, where its board is. */
export async function openGameSessionSetupBoard(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return openGameSessionPlace(
    s,
    actor,
    GAME_SESSION_SETUP_ROW,
    GAME_SESSION_SETUP_BOARD
  );
}

/**
 * A complete setup of `game`'s own drawing other than every one of
 * `others`: the setup a person changes theirs to.
 */
export function anotherCompleteSetup(
  game: TurnHarnessGame,
  others: readonly (string | null)[]
): string {
  const setup = game.shared.turnGame.rules.setup;
  if (setup === undefined) throw new Error(`${game.label} has no setups`);
  for (let draw = 0; draw < 64; draw += 1) {
    const drawn = setup.random(() => (draw + 0.5) / 64);
    if (!others.includes(drawn)) return drawn;
  }
  throw new Error(`${game.label} draws no other setup`);
}

async function screenOf(s: ProductHarness, actor: string) {
  const probe = await readGameSessionProbe(s, actor);
  if (probe?.current == null)
    throw new Error(`${actor} sees no game session to set up`);
  return { probe, game: turnHarnessGameAt(s, probe.current.fen) };
}

/**
 * Whether `actor`'s setup board takes a new arrangement now: not while they
 * are ready, the game is no longer being set up, or their device has no
 * connection (the board holds still).
 */
async function boardTakesSetup(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const { probe } = await screenOf(s, actor);
  const game = probe.current;
  return (
    game !== null &&
    probe.connected &&
    game.status === 'configuring' &&
    probe.mySide !== null &&
    !game.ready.includes(probe.mySide) &&
    (await openGameSessionSetupBoard(s, actor))
  );
}

/**
 * `actor` arranges `setup` on their setup board (`null`: they arrange
 * nothing, so it stays incomplete), and becomes ready with what it holds.
 */
export const arrangeGameSessionPrivateSetup = scenarioAction({
  name: 'arrangeGameSessionPrivateSetup',
  act: async (s, actor: string, setup: string | null) => {
    keepOwnPrivateSetup(s, actor);
    if (setup === null) return;
    const { game } = await screenOf(s, actor);
    const arrange = game.shared.automation.turns.arrange;
    if (arrange === undefined)
      throw new Error(`${game.label} has no setup board gesture`);
    await bringToFront(s, actor);
    await openGameSessionSetupBoard(s, actor);
    await arrange(await actorUi(s, actor), GAME_SESSION_SETUP_BOARD, setup);
  },
});

/**
 * `actor` changes their private setup to `setup`: on their setup board while
 * it takes one, otherwise as the readiness a modified device would send
 * with it.
 */
export const changeGameSessionPrivateSetup = scenarioAction({
  name: 'changeGameSessionPrivateSetup',
  act: async (s, actor: string, setup: string) => {
    keepOwnPrivateSetup(s, actor);
    if (await boardTakesSetup(s, actor)) {
      const { game } = await screenOf(s, actor);
      const arrange = game.shared.automation.turns.arrange;
      if (arrange === undefined)
        throw new Error(`${game.label} has no setup board gesture`);
      await bringToFront(s, actor);
      await arrange(await actorUi(s, actor), GAME_SESSION_SETUP_BOARD, setup);
      return;
    }
    await sendGameSessionChoice(s, actor, {
      operation: 'ready',
      setup,
      ...(await gameSessionReference(s, actor)),
    });
  },
});

/** What `actor`'s Game Session screen shows of their own private setup. */
export type PrivateSetupShown = {
  /** What their setup board holds, '' when nothing; `null` without one. */
  readonly arranged: string | null;
  /** The confirmed setup their game board draws, `null` when none. */
  readonly own: string | null;
  /** What they are told of it (`Your private setup is incomplete.`), if anything. */
  readonly status: string | null;
};

export async function gameSessionPrivateSetupShown(
  s: ProductHarness,
  actor: string
): Promise<PrivateSetupShown> {
  const probe = await readGameSessionProbe(s, actor);
  const ui = await actorUi(s, actor);
  // Their setup board shows on its own place, behind the lobby's row for
  // it: either says they have a setup to arrange.
  const board =
    (await ui.get(GAME_SESSION_SETUP_BOARD).isVisible()) ||
    (await ui.get(GAME_SESSION_SETUP_ROW).isVisible());
  const status = ui.get(`${GAME_SESSION_SETUP_BOARD}-status`);
  return {
    arranged: board ? (probe?.privateSetup?.arranged ?? null) : null,
    own: probe?.privateSetup?.own ?? null,
    status: (await status.isVisible()) ? ((await status.text()) ?? '') : null,
  };
}
