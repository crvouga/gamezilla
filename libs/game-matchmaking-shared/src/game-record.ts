import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { MultiplayerGame } from './game-state';
import { timeControlOf } from './time-control';
export type GameRecordNames = {
  readonly white: string;
  readonly black: string;
};
type RecordFields = Pick<
  MultiplayerGame,
  | 'fen'
  | 'pgn'
  | 'outcome'
  | 'reason'
  | 'time_control'
  | 'white_rating'
  | 'black_rating'
>;
/**
 * The finished game's portable record, in its game's own format; `null`
 * while it is unfinished or when its game offers no history.
 */
export function gameRecord(
  game: RecordFields,
  names: GameRecordNames,
  rules: TurnGames
): string | null {
  if (
    game.outcome !== 'white' &&
    game.outcome !== 'black' &&
    game.outcome !== 'draw'
  )
    return null;
  const history = rules.capability(rules.forPosition(game.fen).id, 'history');
  if (history === undefined) return null;
  return history.record(game.fen, game.pgn, {
    participants: [
      { name: names.white, rating: game.white_rating },
      { name: names.black, rating: game.black_rating },
    ],
    outcome: game.outcome,
    reason: game.reason,
    timeControl: timeControlOf(game.time_control),
  });
}
