/**
 * Battleship as a person plays it on the Game Session screen: a game session
 * set up through ordinary choices, a fleet arranged with the setup board's
 * own gestures (by pointer or by keyboard), readiness, the start, and shots
 * on the targeting board. A choice the screen does not offer is sent as a
 * modified device would, so a refusal is always the product's.
 */

import { battleshipAutomation } from '@libs/battleship-shared-ts/battleship-automation';
import {
  SHIP_IDS,
  type ShipId,
} from '@libs/battleship-shared-ts/battleship-board';
import {
  chooseSetupShip,
  placeShipOnSetupBoard,
  setupBoardIsEditable,
} from '@libs/battleship-shared-ts/battleship-setup-gestures';
import { operateGameSessionControls } from '@libs/game-session-harness-ts/game-session-controls';
import type { GameSessionSeat } from '@libs/game-session-harness-ts/game-session-lineup';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import {
  GAME_SESSION_BOARD,
  playOnGameSessionBoard,
} from '@libs/game-session-harness-ts/game-session-moves';
import { openGameSessionPlace } from '@libs/game-session-harness-ts/game-session-places';
import { readGameSessionScreen } from '@libs/game-session-harness-ts/game-session-screen';
import { chooseGameSession } from '@libs/game-session-harness-ts/game-session-ui';
import { actorPage } from '@libs/harness-ts/actor-page';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { BATTLESHIP_SETUP_BOARD } from './battleship-view';

type DriverNode = ReturnType<Awaited<ReturnType<typeof actorUi>>['get']>;

/** A Battleship game session: who plays each fleet, its setups and its shots. */
export type BattleshipLineup = {
  /** Whose space it is; they create the game (default: Alice). */
  readonly host?: string;
  readonly first?: GameSessionSeat;
  readonly second?: GameSessionSeat;
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

/** The shared game-session lineup, in Battleship's own words. */
export const establishBattleship = scenarioAction({
  name: 'establishBattleship',
  act: async (s, lineup: BattleshipLineup = {}) => {
    await Promise.resolve(
      establishGameSession.act(s, 'battleship', {
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

/** The lobby's row for the person's own fleet, which opens the setup board. */
const FLEET_ROW = 'game-session-setup-open';

/**
 * `actor` opens their fleet's setup board from the lobby, as a person does
 * before arranging or looking at it; nothing when their screen offers no
 * such row (they are there already, or the game is no longer set up).
 */
export async function openFleetSetup(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  if (!(await ui.get(FLEET_ROW).isVisible())) return;
  await openGameSessionPlace(s, actor, FLEET_ROW, BATTLESHIP_SETUP_BOARD);
}

/** {@link openFleetSetup}, as a step of a scenario. */
export const showFleetSetup = scenarioAction({
  name: 'showFleetSetup',
  act: openFleetSetup,
});

async function setupBoard(s: ProductHarness, actor: string) {
  await openFleetSetup(s, actor);
  const ui = await actorUi(s, actor);
  return (await setupBoardIsEditable(ui, BATTLESHIP_SETUP_BOARD)) ? ui : null;
}

/** Choose `ship` on the setup board and turn the placing to `orientation`. */
async function chooseShip(
  s: ProductHarness,
  actor: string,
  ship: ShipId,
  keyboard: boolean | undefined
): Promise<void> {
  const ui = await actorUi(s, actor);
  await chooseSetupShip(ui, BATTLESHIP_SETUP_BOARD, ship, keyboard);
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

export type ShipPlacement = Parameters<typeof placeShipOnSetupBoard>[2];

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
    await openFleetSetup(s, actor);
    const ui = await actorUi(s, actor);
    await placeShipOnSetupBoard(
      ui,
      BATTLESHIP_SETUP_BOARD,
      placement,
      keyboard
    );
    await s.session.waitForIdle();
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
    await openFleetSetup(s, actor);
    const ui = await actorUi(s, actor);
    const random = ui.get('game-session-setup-random');
    // regression: battleship-random-fleet-disabled-tap
    // A ready player's control is shown disabled: a person cannot press it,
    // so asking comes to nothing and the screen's notice is the refusal.
    if (!(await pressable(random))) return;
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
    const screen = await readGameSessionScreen(s, actor);
    const side = screen?.mySide ?? null;
    if (side === null || screen?.current?.ready.includes(side) !== false)
      return;
    const ready = (await actorUi(s, actor)).get('game-session-ready');
    if (!(await pressable(ready))) return;
    await playOnGameSessionBoard(s, actor, async () => {
      await ready.tap();
      return 'made';
    });
  },
});

/** Start the game session as its creator does. */
export const startBattleship = scenarioAction({
  name: 'startBattleship',
  act: (s, actor: string) =>
    operateGameSessionControls(s, actor, { operation: 'start' }),
});

/** Shoot at `cell` on the targeting board: the cell when it fires, else the choice. */
export const shootBattleship = scenarioAction<
  [actor: string, cell: string, keyboard?: boolean]
>({
  name: 'shootBattleship',
  act: async (s, actor: string, cell: string, keyboard?: boolean) => {
    const screen = await readGameSessionScreen(s, actor);
    if (screen?.current == null) throw new Error(`${actor} sees no game`);
    const target = (await actorUi(s, actor)).get(
      `${GAME_SESSION_BOARD}-target-${cell}`
    );
    if (
      (await (
        await actorUi(s, actor)
      )
        .get(`${GAME_SESSION_BOARD}-region`)
        .isVisible()) &&
      (await target.attribute('aria-disabled')) === 'false'
    ) {
      await playOnGameSessionBoard(s, actor, async () => {
        const ui = await actorUi(s, actor);
        const area =
          Number(cell.charAt(0) >= 'f') +
          Math.floor((Number(cell.slice(1)) - 1) / 2) * 2;
        await press(ui.get(`${GAME_SESSION_BOARD}-area-${area}`), keyboard);
        await press(ui.get(`${GAME_SESSION_BOARD}-aim-${cell}`), keyboard);
        const fire = ui.get(`${GAME_SESSION_BOARD}-fire`);
        await fire.wait('enabled');
        await press(fire, keyboard);
        return 'made';
      });
      return;
    }
    await chooseGameSession(s, actor, {
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
    const area =
      Number(cell.charAt(0) >= 'f') +
      Math.floor((Number(cell.slice(1)) - 1) / 2) * 2;
    await ui.get(`${GAME_SESSION_BOARD}-area-${area}`).key('enter');
    await ui.get(`${GAME_SESSION_BOARD}-aim-${cell}`).key('enter');
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
