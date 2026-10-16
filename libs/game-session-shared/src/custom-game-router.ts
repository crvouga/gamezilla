import type { GameCommandContext } from '@libs/spaces-shared/game';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { z } from 'zod';
import { CustomGameAbsenceAttr } from './custom-game-absence';
import { CustomGameAvailableAttr } from './custom-game-availability';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
  CustomGameAvailabilityChanged,
  CustomGamesChanged,
  customGameCmdNs,
  customGameEvtNs,
  EndCustomGameOnTime,
  EndLocalCustomGameOnTime,
  PlayCustomGameBot,
} from './custom-game-commands';
import {
  handleCustomGameChoice,
  handleCustomGameWake,
  refuseCustomGame,
} from './custom-game-handler';
import { localCustomGameChoiceAllowed } from './custom-game-local';
import { CustomGamesAttr, EMPTY_CUSTOM_GAMES } from './custom-game-state';

const noticeSchema = z
  .object({ commandId: z.string(), reason: z.string() })
  .strict();
const ns = createAttrNamespace('chess', 'custom');
export const CustomGameNoticeAttr = ns.json('notice', (v) =>
  v === undefined ? { commandId: '', reason: '' } : noticeSchema.parse(v)
);

export function createCustomGameCommandRouter(rules: TurnGames) {
  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    customGameCmdNs
  )
    .on(ChangeCustomGame, (state, ctx, command) =>
      handleCustomGameChoice(state, ctx, command.payload, rules)
    )
    .on(ChangeLocalCustomGame, (state, ctx, command) =>
      localCustomGameChoiceAllowed(
        CustomGamesAttr.from(state).current,
        command.payload.choice
      )
        ? handleCustomGameChoice(
            state,
            { ...ctx, ts: Math.min(ctx.ts, command.payload.at) },
            command.payload.choice,
            rules
          )
        : refuseCustomGame('connection needed')
    )
    .on(PlayCustomGameBot, (state, ctx, command) =>
      handleCustomGameWake(
        state,
        ctx,
        { wake: command.payload, bot: true },
        rules
      )
    )
    .on(EndLocalCustomGameOnTime, (state, ctx, command) =>
      handleCustomGameWake(
        state,
        ctx,
        { wake: command.payload, bot: false },
        rules
      )
    )
    .on(EndCustomGameOnTime, (state, ctx, command) =>
      handleCustomGameWake(
        state,
        ctx,
        { wake: command.payload, bot: false },
        rules
      )
    );
}

export const customGameEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(customGameEvtNs)
  .on(CustomGamesChanged, (state, _ctx, event) => ({
    ...state,
    ...CustomGamesAttr(event.payload.games),
    ...CustomGameNoticeAttr({
      commandId: event.payload.commandId,
      reason: event.payload.reason,
    }),
  }))
  .on(CustomGameAvailabilityChanged, (state, _ctx, event) => ({
    ...state,
    ...CustomGameAvailableAttr(event.payload.available),
    ...CustomGameAbsenceAttr(event.payload.absence),
  }));

export function customGameInitialAttrs(): RoomState {
  return {
    ...CustomGamesAttr(EMPTY_CUSTOM_GAMES),
    ...CustomGameNoticeAttr({ commandId: '', reason: '' }),
  };
}
