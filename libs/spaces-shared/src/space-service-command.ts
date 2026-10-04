import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-shared/service-identity';
import type { HandleResult, RoomState } from '@pkgs/room-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-shared/types';
import type { GameCommandContext } from './game';
import { MemberLeft, SpaceEnded } from './space-log-messages';
import { SpaceSeatJoined, SpaceSeatLeft } from './space-members-messages';

export const spaceServiceCmdNs = createMessageNamespace('space-service-cmd');
export const ApplySpaceMembership = spaceServiceCmdNs(
  'apply-membership',
  (value): value is { memberId: string; change: 'joined' | 'left' | 'ended' } =>
    isPlainRecord(value) &&
    typeof value['memberId'] === 'string' &&
    value['memberId'].length > 0 &&
    ['joined', 'left', 'ended'].includes(String(value['change']))
);

export const spaceServiceCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(spaceServiceCmdNs).on(ApplySpaceMembership, (_state, ctx, command) => {
  if (ctx.identity !== ROOM_SERVICE_IDENTITY)
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.unauthorized,
        reason: 'requires the space service',
      },
    };
  const memberId = command.payload.memberId;
  return {
    ok: true,
    events:
      command.payload.change === 'ended'
        ? [SpaceEnded({})]
        : command.payload.change === 'joined'
          ? [SpaceSeatJoined({ memberId })]
          : [SpaceSeatLeft({ memberId }), MemberLeft({ memberId })],
  };
});
