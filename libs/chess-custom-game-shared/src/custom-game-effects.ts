import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-shared/builtin';
import type { RoomEffect } from '@pkgs/room-shared/types';
import { EndCustomGameOnTime, PlayCustomGameBot } from './custom-game-commands';
import type { CustomGame } from './custom-game-state';

const BOT_SCHEDULE = 'chess-custom:bot';
const CLOCK_SCHEDULE = 'chess-custom:clock';
export const CUSTOM_GAME_BOT_DELAY_MS = 1000;

export function customGameEffects(
  game: CustomGame | null
): readonly RoomEffect[] {
  const effects: RoomEffect[] = [
    CancelScheduleEffect({ id: BOT_SCHEDULE }),
    CancelScheduleEffect({ id: CLOCK_SCHEDULE }),
  ];
  if (game?.status !== 'active' || game.turnStartedAt === null) return effects;
  const wake = { gameId: game.id, ply: game.moves.length, side: game.turn };
  if (game.minutes > 0)
    effects.push(
      ScheduleEffect({
        id: CLOCK_SCHEDULE,
        at: game.turnStartedAt + game.remaining[game.turn],
        payload: EndCustomGameOnTime(wake),
      })
    );
  if (game[game.turn].kind === 'bot')
    effects.push(
      ScheduleEffect({
        id: BOT_SCHEDULE,
        at: game.turnStartedAt + CUSTOM_GAME_BOT_DELAY_MS,
        payload: PlayCustomGameBot(wake),
      })
    );
  return effects;
}
