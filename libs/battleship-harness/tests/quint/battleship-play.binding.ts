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
  type BattleshipView,
  battleshipView,
  shipCells,
  shotCells,
} from '@libs/battleship-harness/battleship-view';
import { CELLS, SHIP_IDS } from '@libs/battleship-shared/battleship-board';
import { restoreActorConnection } from '@libs/harness/actions';
import { cutConnection } from '@libs/harness/platform';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

/** The model's players: 1 is Alice (the first fleet), 2 is Bob. */
const PLAYERS = { 1: 'alice', 2: 'bob' } as const;
type Player = keyof typeof PLAYERS;
const SIDES = { 1: 'white', 2: 'black' } as const;
/**
 * Alice hosts the space and creates the game, as only a host may; Carol
 * watches it, connected throughout, and her screen shows every shot and
 * readiness as they are.
 */
const WATCHER = 'carol';

/** One hit from Alice's victory: every cell of Bob's fleet but B2 for Alice, 16 misses for Bob. */
const LATE_FIRST_SHOTS = [
  9, 19, 29, 39, 49, 7, 17, 27, 37, 5, 15, 25, 3, 13, 23, 1,
];
const LATE_SECOND_SHOTS = [
  10, 11, 12, 13, 14, 15, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
];

/** The model's cell number as the board names the cell (0 is A1, 99 is J10). */
function cellOf(index: number): string | null {
  return CELLS[index] ?? null;
}
function player(picks: Record<string, QuintValue>): Player {
  const p = Number(picks['p']);
  if (p !== 1 && p !== 2) throw new Error(`No player ${String(p)}`);
  return p;
}
/** A model fleet (each ship's first cell and whether it lies along the row) as the setup spells it. */
function fleetOf(layout: QuintValue): string {
  const ships = layout as ReadonlyMap<QuintValue, QuintValue>;
  return `fleet:${SHIP_IDS.map((ship) => {
    const [first, horizontal] = ships.get(ship) as readonly [number, boolean];
    return `${ship}@${cellOf(first)}${horizontal ? 'h' : 'v'}`;
  }).join(';')}`;
}

/** Each ship's first cell and direction, as the person's board shows the fleet. */
function shownFleet(board: BattleshipBoardShown) {
  return new Map<QuintValue, QuintValue>(
    SHIP_IDS.map((ship) => {
      const cells = shipCells(board, ship).map((cell) => CELLS.indexOf(cell));
      const [first, second] = cells;
      return [
        ship,
        first === undefined || second === undefined
          ? [-1, true]
          : [first, second - first === 1],
      ];
    })
  );
}
/** Each shot a board shows, and whether it found a ship. */
function marks(board: BattleshipBoardShown) {
  return new Set<QuintValue>(
    shotCells(board).map((cell) => [
      CELLS.indexOf(cell),
      board[cell]!.mark !== 'miss',
    ])
  );
}
const PHASES = {
  configuring: 'setup',
  active: 'shooting',
  completed: 'over',
} as const;

function sideNumber(side: string | undefined): number {
  return side === 'white' ? 1 : side === 'black' ? 2 : 0;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'battleship-play',
  traces: 12,
  maxSteps: 20,
  timeoutMs: 600_000,
  actions: {
    init: async (w, picks) => {
      const beginning = picks['beginning'];
      if (beginning === 'new') {
        await w.s.apply(establishBattleship, {
          watchers: [WATCHER],
          ready: false,
          active: false,
        });
        return;
      }
      const late = beginning === 'one hit from victory';
      await w.s.apply(establishBattleship, {
        watchers: [WATCHER],
        fleets: { first: BLUE_FLEET, second: VERTICAL_FLEET },
        shots: late
          ? LATE_FIRST_SHOTS.flatMap((shot, i) => [
              cellOf(shot)!,
              cellOf(LATE_SECOND_SHOTS[i]!)!,
            ])
          : [],
      });
    },
    // A cell off the board is no cell a person can press: nothing happens.
    placeShip: async (w, picks) => {
      const cell = cellOf(Number(picks['first']));
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
    shoot: async (w, picks) => {
      const cell = cellOf(Number(picks['cell']));
      if (cell === null) return;
      await w.s.apply(shootBattleship, PLAYERS[player(picks)], cell);
    },
    loseConnection: (w, picks) => cutConnection(w, PLAYERS[player(picks)]),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, PLAYERS[player(picks)]),
  },
  observe: async (w) => {
    const watched = await w.s.read(battleshipView, WATCHER);
    const seen: Record<Player, BattleshipView> = {
      1: await w.s.read(battleshipView, PLAYERS[1]),
      2: await w.s.read(battleshipView, PLAYERS[2]),
    };
    const game = watched.screen.current;
    if (game === null) throw new Error('Carol sees no game');
    const phase = PHASES[game.status as keyof typeof PHASES];
    const winner = sideNumber(/^(white|black) wins/.exec(game.outcome)?.[1]);
    // Carol watches the first fleet's waters near her: that board holds the
    // second player's shots, the other board the first player's.
    const shotsAt = { 1: watched.target, 2: watched.own } as const;
    const byPlayer = <T extends QuintValue>(read: (p: Player) => T) =>
      new Map<QuintValue, QuintValue>([
        [1, read(1)],
        [2, read(2)],
      ]);
    return {
      fleet: byPlayer((p) =>
        shownFleet(phase === 'setup' ? seen[p].setup : seen[p].own)
      ),
      ready: byPlayer((p) => game.ready.includes(SIDES[p])),
      phase,
      // Once the game is over nobody shoots again; the model keeps the
      // turn with the winner, whose shot ended it.
      turn: winner === 0 ? sideNumber(game.turn) : winner,
      shots: byPlayer(
        (p) =>
          new Set<QuintValue>(
            shotCells(shotsAt[p]).map((c) => CELLS.indexOf(c))
          )
      ),
      hits: byPlayer(
        (p) =>
          shotCells(shotsAt[p]).filter((c) => shotsAt[p][c]!.mark !== 'miss')
            .length
      ),
      sunk: byPlayer(
        (p) =>
          new Set<QuintValue>(
            SHIP_IDS.filter((ship) =>
              shotCells(shotsAt[p]).some(
                (c) =>
                  shotsAt[p][c]!.mark === 'sunk' && shotsAt[p][c]!.ship === ship
              )
            )
          )
      ),
      winner,
      online: byPlayer((p) => seen[p].screen.connected),
      targetingBoard: byPlayer((p) => marks(seen[p].target)),
      ownBoard: byPlayer((p) => marks(seen[p].own)),
    };
  },
});
