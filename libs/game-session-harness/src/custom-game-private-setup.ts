/**
 * A person's own private setup in a custom game of a game that has one, as
 * they arrange it on the game's own setup board and as their screen shows
 * it. A change reaches the space only with readiness, so a change the board
 * no longer takes (the person is ready, or the game has started) is the
 * readiness a modified device would send, and its refusal is the product's.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { readCustomGameProbe } from './custom-game-probe';
import { customGameReference, sendCustomGameChoice } from './custom-game-ui';
import type { HarnessGame } from './harness-game';
import { harnessGameAt } from './harness-game-of';
import { keepOwnPrivateSetup } from './own-private-setups';

/** The setup board of the Custom Game screen. */
export const CUSTOM_GAME_SETUP_BOARD = 'custom-game-setup';

/**
 * A complete setup of `game`'s own drawing other than every one of
 * `others`: the setup a person changes theirs to.
 */
export function anotherCompleteSetup(
  game: HarnessGame,
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
  const probe = await readCustomGameProbe(s, actor);
  if (probe?.current == null)
    throw new Error(`${actor} sees no custom game to set up`);
  return { probe, game: harnessGameAt(s, probe.current.fen) };
}

/** Whether `actor`'s setup board takes a new arrangement now. */
async function boardTakesSetup(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const { probe } = await screenOf(s, actor);
  const game = probe.current;
  return (
    game !== null &&
    game.status === 'configuring' &&
    probe.mySide !== null &&
    !game.ready.includes(probe.mySide) &&
    (await (await actorUi(s, actor)).get(CUSTOM_GAME_SETUP_BOARD).isVisible())
  );
}

/**
 * `actor` arranges `setup` on their setup board (`null`: they arrange
 * nothing, so it stays incomplete), and becomes ready with what it holds.
 */
export const arrangeCustomGamePrivateSetup = scenarioAction({
  name: 'arrangeCustomGamePrivateSetup',
  act: async (s, actor: string, setup: string | null) => {
    keepOwnPrivateSetup(s, actor);
    if (setup === null) return;
    const { game } = await screenOf(s, actor);
    const arrange = game.shared.automation.arrange;
    if (arrange === undefined)
      throw new Error(`${game.label} has no setup board gesture`);
    await bringToFront(s, actor);
    await arrange(await actorUi(s, actor), CUSTOM_GAME_SETUP_BOARD, setup);
  },
});

/**
 * `actor` changes their private setup to `setup`: on their setup board while
 * it takes one, otherwise as the readiness a modified device would send
 * with it.
 */
export const changeCustomGamePrivateSetup = scenarioAction({
  name: 'changeCustomGamePrivateSetup',
  act: async (s, actor: string, setup: string) => {
    keepOwnPrivateSetup(s, actor);
    if (await boardTakesSetup(s, actor)) {
      const { game } = await screenOf(s, actor);
      const arrange = game.shared.automation.arrange;
      if (arrange === undefined)
        throw new Error(`${game.label} has no setup board gesture`);
      await bringToFront(s, actor);
      await arrange(await actorUi(s, actor), CUSTOM_GAME_SETUP_BOARD, setup);
      return;
    }
    await sendCustomGameChoice(s, actor, {
      operation: 'ready',
      setup,
      ...(await customGameReference(s, actor)),
    });
  },
});

/** What `actor`'s Custom Game screen shows of their own private setup. */
export type PrivateSetupShown = {
  /** What their setup board holds, '' when nothing; `null` without one. */
  readonly arranged: string | null;
  /** The confirmed setup their game board draws, `null` when none. */
  readonly own: string | null;
  /** What they are told of it (`Your private setup is incomplete.`), if anything. */
  readonly status: string | null;
};

export async function customGamePrivateSetupShown(
  s: ProductHarness,
  actor: string
): Promise<PrivateSetupShown> {
  const probe = await readCustomGameProbe(s, actor);
  const ui = await actorUi(s, actor);
  const board = await ui.get(CUSTOM_GAME_SETUP_BOARD).isVisible();
  const status = ui.get(`${CUSTOM_GAME_SETUP_BOARD}-status`);
  return {
    arranged: board ? (probe?.privateSetup?.arranged ?? null) : null,
    own: probe?.privateSetup?.own ?? null,
    status: (await status.isVisible()) ? ((await status.text()) ?? '') : null,
  };
}
