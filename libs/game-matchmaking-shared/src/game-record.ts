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
/** Each registered game owns its notation and export format. */
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
  return rules.forPosition(game.fen).record(game.fen, game.pgn, {
    participants: [
      { name: names.white, rating: game.white_rating },
      { name: names.black, rating: game.black_rating },
    ],
    outcome: game.outcome,
    reason: game.reason,
    timeControl: timeControlOf(game.time_control),
  });
}
