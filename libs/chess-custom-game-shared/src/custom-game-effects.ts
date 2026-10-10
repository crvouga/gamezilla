import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared/builtin';
import type { RoomEffect } from '@pkgs/room-root-shared/types';
import {
  EndCustomGameOnTime,
  EndLocalCustomGameOnTime,
  PlayCustomGameBot,
} from './custom-game-commands';
import { soloCustomGame } from './custom-game-local';
import type { CustomGame } from './custom-game-state';

const BOT_SCHEDULE = 'chess-custom:bot';
const CLOCK_SCHEDULE = 'chess-custom:clock';
export const CUSTOM_GAME_BOT_DELAY_MS = 1000;

export function customGameEffects(
  game: CustomGame | null
): readonly RoomEffect[] {
  return schedules(game, false);
}

export function localCustomGameEffects(
  game: CustomGame | null
): readonly RoomEffect[] {
  return schedules(game, true);
}

function schedules(
  game: CustomGame | null,
  local: boolean
): readonly RoomEffect[] {
  const effects: RoomEffect[] = [
    CancelScheduleEffect({ id: BOT_SCHEDULE }),
    CancelScheduleEffect({ id: CLOCK_SCHEDULE }),
  ];
  if (game?.status !== 'active' || game.turnStartedAt === null) return effects;
  const wake = { gameId: game.id, ply: game.moves.length, side: game.turn };
  if (game.minutes > 0 && soloCustomGame(game) === local)
    effects.push(
      ScheduleEffect({
        id: CLOCK_SCHEDULE,
        at: game.turnStartedAt + game.remaining[game.turn],
        payload: local
          ? EndLocalCustomGameOnTime({
              ...wake,
              at: game.turnStartedAt + game.remaining[game.turn],
            })
          : EndCustomGameOnTime(wake),
      })
    );
  if (local && game[game.turn].kind === 'bot')
    effects.push(
      ScheduleEffect({
        id: BOT_SCHEDULE,
        at: game.turnStartedAt + CUSTOM_GAME_BOT_DELAY_MS,
        payload: PlayCustomGameBot(wake),
      })
    );
  return effects;
}
