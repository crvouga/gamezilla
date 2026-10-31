import {
  type BattleshipPosition,
  parseShotAction,
} from '@libs/battleship-shared-ts/battleship-position';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { shotSentence, sideName, turnSentence } from './battleship-copy';

/** The latest shot and whose turn it is, in words; `viewer` is `null` for a watcher. */
export function statusText(
  battle: BattleshipPosition,
  viewer: GameSide | null
): string {
  const action = battle.actions.at(-1);
  const shot = action === undefined ? null : parseShotAction(action);
  const shooter: GameSide = battle.actions.length % 2 === 1 ? 'white' : 'black';
  const fired =
    shot === null
      ? ''
      : shotSentence(shot, shooter === viewer ? null : sideName(shooter));
  const turn = turnSentence({
    turn: battle.turn,
    winner: battle.winner,
    viewer,
  });
  return fired === '' ? turn : `${fired} ${turn}`;
}
