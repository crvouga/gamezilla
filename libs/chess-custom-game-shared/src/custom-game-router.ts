import type { GameCommandContext } from '@libs/spaces-shared/game';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { z } from 'zod';
import {
  ChangeCustomGame,
  CustomGamesChanged,
  customGameCmdNs,
  customGameEvtNs,
  EndCustomGameOnTime,
  PlayCustomGameBot,
} from './custom-game-commands';
import {
  handleCustomGameChoice,
  handleCustomGameWake,
} from './custom-game-handler';
import { CustomGamesAttr, EMPTY_CUSTOM_GAMES } from './custom-game-state';

const noticeSchema = z
  .object({ commandId: z.string(), reason: z.string() })
  .strict();
const ns = createAttrNamespace('chess', 'custom');
export const CustomGameNoticeAttr = ns.json('notice', (v) =>
  v === undefined ? { commandId: '', reason: '' } : noticeSchema.parse(v)
);

export const customGameCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(customGameCmdNs)
  .on(ChangeCustomGame, (state, ctx, command) =>
    handleCustomGameChoice(state, ctx, command.payload)
  )
  .on(PlayCustomGameBot, (state, ctx, command) =>
    handleCustomGameWake(state, ctx, command.payload, true)
  )
  .on(EndCustomGameOnTime, (state, ctx, command) =>
    handleCustomGameWake(state, ctx, command.payload, false)
  );

export const customGameEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(customGameEvtNs).on(CustomGamesChanged, (state, _ctx, event) => ({
  ...state,
  ...CustomGamesAttr(event.payload.games),
  ...CustomGameNoticeAttr({
    commandId: event.payload.commandId,
    reason: event.payload.reason,
  }),
}));

export function customGameInitialAttrs(): RoomState {
  return {
    ...CustomGamesAttr(EMPTY_CUSTOM_GAMES),
    ...CustomGameNoticeAttr({ commandId: '', reason: '' }),
  };
}
