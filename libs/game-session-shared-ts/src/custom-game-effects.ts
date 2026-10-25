import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import type { RoomEffect } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  EndCustomGameOnTime,
  EndLocalCustomGameOnTime,
  PlayCustomGameBot,
} from './custom-game-commands';
import { soloCustomGame } from './custom-game-local';
import type { CustomGame } from './custom-game-state';
import { customGameBotPlays, customGameCommitting } from './custom-game-state';

const BOT_SCHEDULE = 'chess-custom:bot';
const CLOCK_SCHEDULE = 'chess-custom:clock';
export const CUSTOM_GAME_BOT_DELAY_MS = 1000;

export function customGameEffects(
  game: CustomGame | null,
  rules: TurnGames
): readonly RoomEffect[] {
  return schedules(game, rules, false);
}

export function localCustomGameEffects(
  game: CustomGame | null,
  rules: TurnGames
): readonly RoomEffect[] {
  return schedules(game, rules, true);
}

/**
 * The side whose bot decides next: the bot or stand-in to move, or, while
 * every side commits, the first such side still to commit.
 */
function botToDecide(game: CustomGame): CustomGame['turn'] | null {
  if (game.awaiting.length > 0)
    return game.awaiting.find((side) => customGameBotPlays(game, side)) ?? null;
  return customGameBotPlays(game, game.turn) ? game.turn : null;
}

function schedules(
  game: CustomGame | null,
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
  const solo = soloCustomGame(game, rules);
  if (game.minutes > 0 && solo === local && !customGameCommitting(game)) {
    const wake = { gameId: game.id, ply: game.moves.length, side: game.turn };
    const at = game.turnStartedAt + game.remaining[game.turn];
    effects.push(
      ScheduleEffect({
        id: CLOCK_SCHEDULE,
        at,
        payload: local
          ? EndLocalCustomGameOnTime({ ...wake, at })
          : EndCustomGameOnTime(wake),
      })
    );
  }
  const bot = botToDecide(game);
  if ((local || !solo) && bot !== null)
    effects.push(
      ScheduleEffect({
        id: BOT_SCHEDULE,
        at: game.turnStartedAt + CUSTOM_GAME_BOT_DELAY_MS,
        payload: PlayCustomGameBot({ ...wake, side: bot }),
      })
    );
  return effects;
}
