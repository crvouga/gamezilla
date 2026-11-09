import {
  type BattleshipPosition,
  parseShotAction,
} from '@libs/battleship-shared-ts/battleship-position';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  ownTurnAfterShot,
  shotSentence,
  sideName,
  turnSentence,
} from './battleship-copy';

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
  if (fired === '')
    return turnSentence({ turn: battle.turn, winner: battle.winner, viewer });
  // After the shot's own sentence the viewer's turn needs no more than
  // "Your turn.", so a sinking still fits one line on a phone.
  const yours = battle.winner === null && viewer === battle.turn;
  return yours
    ? `${fired} ${ownTurnAfterShot()}`
    : `${fired} ${turnSentence({ turn: battle.turn, winner: battle.winner, viewer })}`;
}
