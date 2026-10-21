import {
  establishBattleship,
  shootBattleship,
} from '@libs/battleship-harness/battleship-actions';
import {
  BLUE_FLEET,
  VERTICAL_FLEET,
} from '@libs/battleship-harness/battleship-fixtures';
import {
  type BattleshipBoardShown,
  shotCells,
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
  sideNumber,
  WATCHER,
  watchGame,
} from './battleship-model';

/** One hit from Alice's victory: every cell of Bob's fleet but B2 for Alice, 16 misses for Bob. */
const LATE_FIRST_SHOTS = [
  9, 19, 29, 39, 49, 7, 17, 27, 37, 5, 15, 25, 3, 13, 23, 1,
];
const LATE_SECOND_SHOTS = [
  10, 11, 12, 13, 14, 15, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
];

/** Each shot a board shows, and whether it found a ship. */
function marks(board: BattleshipBoardShown) {
  return new Set<QuintValue>(
    shotCells(board).map((cell) => [
      CELLS.indexOf(cell),
      board[cell]!.mark !== 'miss',
    ])
  );
}

bindQuintModel<QuintHarnessWorld>({
  model: 'battleship-play',
  traces: 8,
  maxSteps: 20,
  timeoutMs: 600_000,
  // Two boards of 100 cells each: Apalache gives no verdict on every
  // invariant at once within the models check's deadline, so each
  // invariant is its own proof, two steps from each beginning.
  verifySteps: 2,
  boundedInvariantGroupSize: 1,
  actions: {
    init: async (w, picks) => {
      const late = picks['beginning'] === 'one hit from victory';
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
    const { watched, seen, game, phase, winner } = await watchGame(w);
    // Carol watches the first fleet's waters near her: that board holds the
    // second player's shots, the other board the first player's.
    const shotsAt = { 1: watched.target, 2: watched.own } as const;
    return {
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
