import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
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
 * while it is unfinished. Every game offering matchmaking offers history
 * (`TurnGameCapabilities`), so a finished matched game always has one.
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
  const id = rules.forPosition(game.fen).id;
  const history = rules.capability(id, 'history');
  if (history === undefined)
    throw new Error(
      `${id}: a finished matched game's record needs history, yet the game offers matchmaking without it — define it with defineGame, which refuses that`
    );
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
