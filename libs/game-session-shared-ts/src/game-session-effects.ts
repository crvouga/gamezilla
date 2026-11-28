import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import type { RoomEffect } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  EndGameSessionOnTime,
  EndLocalGameSessionOnTime,
  PlayGameSessionBot,
} from './game-session-commands';
import { soloGameSession } from './game-session-local';
import type { GameSession } from './game-session-state';
import {
  gameSessionBotPlays,
  gameSessionCommitting,
} from './game-session-state';

const BOT_SCHEDULE = 'chess-custom:bot';
const CLOCK_SCHEDULE = 'chess-custom:clock';
export const GAME_SESSION_BOT_DELAY_MS = 1000;

export function gameSessionEffects(
  game: GameSession | null,
  rules: TurnGames
): readonly RoomEffect[] {
  return schedules(game, rules, false);
}

export function localGameSessionEffects(
  game: GameSession | null,
  rules: TurnGames
): readonly RoomEffect[] {
  return schedules(game, rules, true);
}

/**
 * The side whose bot decides next: the bot or stand-in to move, or, while
 * every side commits, the first such side still to commit.
 */
function botToDecide(game: GameSession): GameSession['turn'] | null {
  if (game.awaiting.length > 0)
    return (
      game.awaiting.find((side) => gameSessionBotPlays(game, side)) ?? null
    );
  return gameSessionBotPlays(game, game.turn) ? game.turn : null;
}

function schedules(
  game: GameSession | null,
  rules: TurnGames,
  local: boolean
): readonly RoomEffect[] {
  const effects: RoomEffect[] = [
    CancelScheduleEffect({ id: BOT_SCHEDULE }),
    CancelScheduleEffect({ id: CLOCK_SCHEDULE }),
  ];
  if (game?.status !== 'active' || game.turnStartedAt === null) return effects;
  if (rules.turnsForPosition(game.fen) === undefined) return effects;
  const wake = { gameId: game.id, ply: game.moves.length, side: game.turn };
  const solo = soloGameSession(game, rules);
  if (game.minutes > 0 && solo === local && !gameSessionCommitting(game)) {
    const wake = { gameId: game.id, ply: game.moves.length, side: game.turn };
    const at = game.turnStartedAt + game.remaining[game.turn];
    effects.push(
      ScheduleEffect({
        id: CLOCK_SCHEDULE,
        at,
        payload: local
          ? EndLocalGameSessionOnTime({ ...wake, at })
          : EndGameSessionOnTime(wake),
      })
    );
  }
  const bot = botToDecide(game);
  if ((local || !solo) && bot !== null)
    effects.push(
      ScheduleEffect({
        id: BOT_SCHEDULE,
        at: game.turnStartedAt + GAME_SESSION_BOT_DELAY_MS,
        payload: PlayGameSessionBot({ ...wake, side: bot }),
      })
    );
  return effects;
}
