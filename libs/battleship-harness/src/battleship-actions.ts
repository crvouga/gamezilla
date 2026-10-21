/**
 * Battleship as a person plays it on the Custom Game screen: a custom game
 * set up through ordinary choices, a fleet arranged with the setup board's
 * own gestures (by pointer or by keyboard), readiness, the start, and shots
 * on the targeting board. A choice the screen does not offer is sent as a
 * modified device would, so a refusal is always the product's.
 */

import { battleshipAutomation } from '@libs/battleship-shared/battleship-automation';
import {
  SHIP_IDS,
  type ShipId,
} from '@libs/battleship-shared/battleship-board';
import type { Orientation } from '@libs/battleship-shared/battleship-fleet';
import { operateCustomGameControls } from '@libs/game-session-harness/custom-game-controls';
import type { CustomGameSeat } from '@libs/game-session-harness/custom-game-lineup';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import {
  CUSTOM_GAME_BOARD,
  playOnCustomGameBoard,
} from '@libs/game-session-harness/custom-game-moves';
import { readCustomGameScreen } from '@libs/game-session-harness/custom-game-screen';
import { chooseCustomGame } from '@libs/game-session-harness/custom-game-ui';
import { actorPage } from '@libs/harness/actor-page';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import {
  BATTLESHIP_SETUP_BOARD,
  battleshipSetupRefusal,
  battleshipView,
  shipCells,
} from './battleship-view';

type DriverNode = ReturnType<Awaited<ReturnType<typeof actorUi>>['get']>;

/** A Battleship custom game: who plays each fleet, its setups and its shots. */
export type BattleshipLineup = {
  /** Whose space it is; they create the game (default: Alice). */
  readonly host?: string;
  readonly first?: CustomGameSeat;
  readonly second?: CustomGameSeat;
  readonly watchers?: readonly string[];
  /** Every person is ready with a fleet (default). */
  readonly ready?: boolean;
  /** The game is started (default). */
  readonly active?: boolean;
  /** Each side's fleet other than its known one. */
  readonly fleets?: { readonly first?: string; readonly second?: string };
  /** The cells shot at from the start, the sides taking turns. */
  readonly shots?: readonly string[];
};

/** The shared custom-game lineup, in Battleship's own words. */
export const establishBattleship = scenarioAction({
  name: 'establishBattleship',
  act: async (s, lineup: BattleshipLineup = {}) => {
    await Promise.resolve(
      establishCustomGame.act(s, 'battleship', {
        ...(lineup.host === undefined ? {} : { host: lineup.host }),
        ...(lineup.first === undefined ? {} : { first: lineup.first }),
        ...(lineup.second === undefined ? {} : { second: lineup.second }),
        ...(lineup.watchers === undefined ? {} : { watchers: lineup.watchers }),
        ...(lineup.ready === undefined ? {} : { ready: lineup.ready }),
        ...(lineup.active === undefined ? {} : { active: lineup.active }),
        setups: {
          ...(lineup.fleets?.first === undefined
            ? {}
            : { white: lineup.fleets.first }),
          ...(lineup.fleets?.second === undefined
            ? {}
            : { black: lineup.fleets.second }),
        },
        moves: lineup.shots ?? [],
      })
    );
  },
});

/** Press a control as a person does: a tap, or the keyboard on it. */
async function press(
  node: DriverNode,
  keyboard: boolean | undefined,
  key: 'enter' | 'space' = 'enter'
) {
  if (keyboard) await node.key(key);
  else await node.tap();
}

async function setupBoard(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  return (await ui.get(`${BATTLESHIP_SETUP_BOARD}-grid`).isVisible())
    ? ui
    : null;
}

/** Choose `ship` on the setup board and turn the placing to `orientation`. */
async function chooseShip(
  s: ProductHarness,
  actor: string,
  ship: ShipId,
  keyboard: boolean | undefined
): Promise<void> {
  const ui = await actorUi(s, actor);
  await press(
    ui.get(`${BATTLESHIP_SETUP_BOARD}-ship-${ship}`),
    keyboard,
    'space'
  );
  await s.session.waitForIdle();
}

async function rotateChosen(
  s: ProductHarness,
  actor: string,
  keyboard: boolean | undefined
): Promise<void> {
  const ui = await actorUi(s, actor);
  await press(ui.get(`${BATTLESHIP_SETUP_BOARD}-rotate`), keyboard);
  await s.session.waitForIdle();
}

/** Where a ship goes: its first cell and which way it runs from there. */
export type ShipPlacement = {
  readonly ship: ShipId;
  readonly cell: string;
  readonly orientation: Orientation;
};

/**
 * Place `ship` from `cell` running `orientation` (`h` along the row, `v`
 * down the column) on the setup board: choose the ship, turn it, press the
 * cell. Turning a placed ship turns it where it lies, so when the new place
 * is refused the person turns it back, and the ship stays where it was.
 */
export const placeBattleshipShip = scenarioAction<
  [actor: string, placement: ShipPlacement, keyboard?: boolean]
>({
  name: 'placeBattleshipShip',
  act: async (
    s,
    actor: string,
    placement: ShipPlacement,
    keyboard?: boolean
  ) => {
    const { ship, cell, orientation } = placement;
    const ui = await setupBoard(s, actor);
    if (ui === null) return;
    const before = shipCells((await battleshipView(s, actor)).setup, ship);
    await chooseShip(s, actor, ship, keyboard);
    const rotate = ui.get(`${BATTLESHIP_SETUP_BOARD}-rotate`);
    const turned =
      (await rotate.attribute('data-orientation')) !== orientation &&
      (await rotate.attribute('disabled')) === null;
    if (turned) await rotateChosen(s, actor, keyboard);
    await press(ui.get(`${BATTLESHIP_SETUP_BOARD}-cell-${cell}`), keyboard);
    await s.session.waitForIdle();
    if (!turned || (await battleshipSetupRefusal(s, actor)) === null) return;
    const now = shipCells((await battleshipView(s, actor)).setup, ship);
    if (now.join() !== before.join()) await rotateChosen(s, actor, keyboard);
  },
});

/** Turn a ship between horizontal and vertical on the setup board. */
export const rotateBattleshipShip = scenarioAction<
  [actor: string, ship: ShipId, keyboard?: boolean]
>({
  name: 'rotateBattleshipShip',
  act: async (s, actor: string, ship: ShipId, keyboard?: boolean) => {
    if ((await setupBoard(s, actor)) === null) return;
    await chooseShip(s, actor, ship, keyboard);
    await rotateChosen(s, actor, keyboard);
  },
});

/**
 * Arrange exactly `fleet` on the setup board: take every ship off it, then
 * place each with the board's own gestures.
 */
export const arrangeBattleshipFleet = scenarioAction({
  name: 'arrangeBattleshipFleet',
  act: async (s, actor: string, fleet: string) => {
    const ui = await setupBoard(s, actor);
    if (ui === null) return;
    for (const ship of SHIP_IDS) {
      await chooseShip(s, actor, ship, false);
      const remove = ui.get(`${BATTLESHIP_SETUP_BOARD}-remove`);
      if (await pressable(remove)) await remove.tap();
      await s.session.waitForIdle();
    }
    await battleshipAutomation.arrange?.(ui, BATTLESHIP_SETUP_BOARD, fleet);
    await s.session.waitForIdle();
  },
});

/** Ask for a random fleet in place of the ships placed so far. */
export const askForRandomFleet = scenarioAction({
  name: 'askForRandomFleet',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    const random = ui.get('custom-game-setup-random');
    if (!(await random.isVisible())) return;
    await random.tap();
    await s.session.waitForIdle();
  },
});

async function pressable(node: DriverNode): Promise<boolean> {
  return (
    (await node.isVisible()) &&
    (await node.attribute('disabled')) === null &&
    (await node.attribute('aria-disabled')) !== 'true'
  );
}

/**
 * Press "I'm ready" with the fleet on the setup board. A control the screen
 * does not offer (an incomplete fleet), or one that would withdraw
 * readiness, is not pressed: nothing happens.
 */
export const becomeBattleshipReady = scenarioAction({
  name: 'becomeBattleshipReady',
  act: async (s, actor: string) => {
    const screen = await readCustomGameScreen(s, actor);
    const side = screen?.mySide ?? null;
    if (side === null || screen?.current?.ready.includes(side) !== false)
      return;
    const ready = (await actorUi(s, actor)).get('custom-game-ready');
    if (!(await pressable(ready))) return;
    await playOnCustomGameBoard(s, actor, async () => {
      await ready.tap();
      return 'made';
    });
  },
});

/** Start the custom game as its creator does. */
export const startBattleship = scenarioAction({
  name: 'startBattleship',
  act: (s, actor: string) =>
    operateCustomGameControls(s, actor, { operation: 'start' }),
});

/** Shoot at `cell` on the targeting board: the cell when it fires, else the choice. */
export const shootBattleship = scenarioAction<
  [actor: string, cell: string, keyboard?: boolean]
>({
  name: 'shootBattleship',
  act: async (s, actor: string, cell: string, keyboard?: boolean) => {
    const screen = await readCustomGameScreen(s, actor);
    if (screen?.current == null) throw new Error(`${actor} sees no game`);
    const target = (await actorUi(s, actor)).get(
      `${CUSTOM_GAME_BOARD}-target-${cell}`
    );
    if (
      (await target.isVisible()) &&
      (await target.attribute('aria-disabled')) === 'false'
    ) {
      await playOnCustomGameBoard(s, actor, async () => {
        await press(target, keyboard);
        return 'made';
      });
      return;
    }
    await chooseCustomGame(s, actor, {
      operation: 'move',
      uci: cell,
      ply: screen.current.moves.length,
    });
  },
});

/** Choose a cell of the targeting board with the keyboard (Enter on it). */
export const chooseBattleshipTarget = scenarioAction({
  name: 'chooseBattleshipTarget',
  act: async (s, actor: string, cell: string) => {
    const ui = await actorUi(s, actor);
    await ui.get(`${CUSTOM_GAME_BOARD}-target-${cell}`).key('enter');
    await s.session.waitForIdle();
  },
});

export const preferBattleshipReducedMotion = scenarioAction({
  name: 'preferBattleshipReducedMotion',
  act: async (s, actor: string) => {
    await s.actors.get(actor)!.device.setReducedMotion(true);
  },
});

/** `actor` listens to the app as it reads the Battleship board aloud. */
export const listenToBattleship = scenarioAction({
  name: 'listenToBattleship',
  act: async (s, actor: string) => {
    await actorPage(s, actor);
  },
});

export const BATTLESHIP_ACTIONS = [
  establishBattleship,
  placeBattleshipShip,
  rotateBattleshipShip,
  arrangeBattleshipFleet,
  askForRandomFleet,
  becomeBattleshipReady,
  startBattleship,
  shootBattleship,
  chooseBattleshipTarget,
  preferBattleshipReducedMotion,
  listenToBattleship,
];
