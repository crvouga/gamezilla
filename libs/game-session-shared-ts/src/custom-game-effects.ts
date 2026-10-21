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
  const wake = { gameId: game.id, ply: game.moves.length, side: game.turn };
  const solo = soloCustomGame(game, rules);
  if (game.minutes > 0 && solo === local)
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
  if ((local || !solo) && game[game.turn].kind === 'bot')
    effects.push(
      ScheduleEffect({
        id: BOT_SCHEDULE,
        at: game.turnStartedAt + CUSTOM_GAME_BOT_DELAY_MS,
        payload: PlayCustomGameBot(wake),
      })
    );
  return effects;
}
