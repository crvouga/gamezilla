import {
  arrangeBattleshipFleet,
  askForRandomFleet,
  becomeBattleshipReady,
  establishBattleship,
  placeBattleshipShip,
  rotateBattleshipShip,
  shootBattleship,
  startBattleship,
} from '@libs/battleship-harness/battleship-actions';
import {
  BLUE_FLEET,
  VERTICAL_FLEET,
} from '@libs/battleship-harness/battleship-fixtures';
import {
  type BattleshipBoardShown,
  shipCells,
} from '@libs/battleship-harness/battleship-view';
import { CELLS, SHIP_IDS } from '@libs/battleship-shared/battleship-board';
import { restoreActorConnection } from '@libs/harness/actions';
import { cutConnection } from '@libs/harness/platform';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import {
  byPlayer,
  cellOf,
  PLAYERS,
  player,
  SIDES,
  WATCHER,
  watchGame,
} from './battleship-model';

/** A model row and column as the board names the cell, or null off the board. */
function cellAt(row: number, column: number): string | null {
  return row < 0 || row > 9 || column < 0 || column > 9
    ? null
    : cellOf(row * 10 + column);
}
/** A model fleet (each ship's first row and column, and whether it lies along the row) as the setup spells it. */
function fleetOf(layout: QuintValue): string {
  const ships = layout as ReadonlyMap<QuintValue, QuintValue>;
  return `fleet:${SHIP_IDS.map((ship) => {
    const [row, column, horizontal] = ships.get(ship) as readonly [
      number,
      number,
      boolean,
    ];
    return `${ship}@${cellAt(row, column)}${horizontal ? 'h' : 'v'}`;
  }).join(';')}`;
}

/** Each ship's first row and column and its direction, as the person's board shows the fleet. */
function shownFleet(board: BattleshipBoardShown) {
  return new Map<QuintValue, QuintValue>(
    SHIP_IDS.map((ship) => {
      const cells = shipCells(board, ship).map((cell) => CELLS.indexOf(cell));
      const [first, second] = cells;
      return [
        ship,
        first === undefined || second === undefined
          ? [-1, -1, true]
          : [Math.floor(first / 10), first % 10, second - first === 1],
      ];
    })
  );
}

bindQuintModel<QuintHarnessWorld>({
  model: 'battleship-fleet-setup',
  traces: 8,
  maxSteps: 16,
  timeoutMs: 600_000,
  // Seven commands over two players' fleets: Apalache gives no verdict at
  // three steps within the models check's deadline. Each beginning puts
  // readiness and the start within two.
  verifySteps: 2,
  actions: {
    init: async (w, picks) => {
      const beginning = picks['beginning'];
      if (beginning === 'ready') {
        await w.s.apply(establishBattleship, {
          watchers: [WATCHER],
          fleets: { first: BLUE_FLEET, second: VERTICAL_FLEET },
          active: false,
        });
        return;
      }
      await w.s.apply(establishBattleship, {
        watchers: [WATCHER],
        ready: false,
        active: false,
      });
      if (beginning !== 'arranged') return;
      // Each player asks for a random fleet and moves its ships to the
      // model's: Alice's along the rows, Bob's down the columns.
      for (const [actor, fleet] of [
        [PLAYERS[1], BLUE_FLEET],
        [PLAYERS[2], VERTICAL_FLEET],
      ] as const) {
        await w.s.apply(askForRandomFleet, actor);
        await w.s.apply(arrangeBattleshipFleet, actor, fleet);
      }
    },
    // A cell off the board is no cell a person can press: nothing happens.
    placeShip: async (w, picks) => {
      const cell = cellAt(Number(picks['row']), Number(picks['column']));
      if (cell === null) return;
      await w.s.apply(placeBattleshipShip, PLAYERS[player(picks)], {
        ship: String(picks['ship']) as (typeof SHIP_IDS)[number],
        cell,
        orientation: picks['horizontal'] === true ? 'h' : 'v',
      });
    },
    rotateShip: (w, picks) =>
      w.s.apply(
        rotateBattleshipShip,
        PLAYERS[player(picks)],
        String(picks['ship']) as (typeof SHIP_IDS)[number]
      ),
    // The app's random fleet is any legal fleet; the model names it as one
    // of two. The player asks for a random fleet, then moves its ships to
    // the fleet the model drew.
    randomFleet: async (w, picks) => {
      const actor = PLAYERS[player(picks)];
      await w.s.apply(askForRandomFleet, actor);
      await w.s.apply(arrangeBattleshipFleet, actor, fleetOf(picks['layout']!));
    },
    becomeReady: (w, picks) =>
      w.s.apply(becomeBattleshipReady, PLAYERS[player(picks)]),
    startGame: (w) => w.s.apply(startBattleship, 'alice'),
    // A shot before the start: the person asks to shoot, and is refused.
    shoot: (w, picks) =>
      w.s.apply(
        shootBattleship,
        PLAYERS[player(picks)],
        cellOf(Number(picks['cell']))!
      ),
    loseConnection: (w, picks) => cutConnection(w, PLAYERS[player(picks)]),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, PLAYERS[player(picks)]),
  },
  observe: async (w) => {
    const { seen, game, phase } = await watchGame(w);
    return {
      fleet: byPlayer((p) =>
        shownFleet(phase === 'setup' ? seen[p].setup : seen[p].own)
      ),
      ready: byPlayer((p) => game.ready.includes(SIDES[p])),
      phase,
      online: byPlayer((p) => seen[p].screen.connected),
    };
  },
});
