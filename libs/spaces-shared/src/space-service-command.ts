import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import { ROOM_PRESENCE_IDENTITY } from '@pkgs/room-root-shared/builtin';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared/service-identity';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { GameCommandContext } from './game';
import { MemberLeft, SpaceEnded } from './space-log-messages';
import {
  nextSpaceAway,
  SpaceAwayChanged,
  SpaceRestrictionsChanged,
  SpaceSeatJoined,
  SpaceSeatLeft,
  spaceAwayChanges,
  spaceRestrictionPairs,
} from './space-members-messages';

export const spaceServiceCmdNs = createMessageNamespace('space-service-cmd');
export const ApplySpaceMembership = spaceServiceCmdNs(
  'apply-membership',
  (value): value is { memberId: string; change: 'joined' | 'left' | 'ended' } =>
    isPlainRecord(value) &&
    typeof value['memberId'] === 'string' &&
    value['memberId'].length > 0 &&
    ['joined', 'left', 'ended'].includes(String(value['change']))
);

/** The friends context's blocks among the space's members, all of them. */
export const ApplySpaceRestrictions = spaceServiceCmdNs(
  'apply-restrictions',
  (value): value is { blocks: readonly (readonly [string, string])[] } =>
    isPlainRecord(value) &&
    Array.isArray(value['blocks']) &&
    value['blocks'].every(
      (pair) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        pair.every((id) => typeof id === 'string' && id.length > 0)
    )
);

/** The room's live presence changed: who of the members is connected now. */
export const ObserveSpacePresence = spaceServiceCmdNs(
  'observe-presence',
  (value): value is { present: readonly string[] } =>
    isPlainRecord(value) &&
    Array.isArray(value['present']) &&
    value['present'].every((id) => typeof id === 'string')
);

/** The presence command for the room engine, when presence changes who is away. */
export function spacePresenceCommand(
  state: RoomState,
  present: readonly string[]
): ReturnType<typeof ObserveSpacePresence> | null {
  return spaceAwayChanges(state, present)
    ? ObserveSpacePresence({ present: [...present].sort() })
    : null;
}

export const spaceServiceCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(spaceServiceCmdNs)
  .on(ApplySpaceMembership, (_state, ctx, command) => {
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
  })
  .on(ApplySpaceRestrictions, (_state, ctx, command) => {
    if (ctx.identity !== ROOM_SERVICE_IDENTITY)
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.unauthorized,
          reason: 'requires the space service',
        },
      };
    return {
      ok: true,
      events: [
        SpaceRestrictionsChanged({
          pairs: spaceRestrictionPairs(command.payload.blocks),
        }),
      ],
    };
  })
  .on(ObserveSpacePresence, (state, ctx, command) => {
    if (ctx.identity !== ROOM_PRESENCE_IDENTITY)
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.unauthorized,
          reason: 'requires the room engine',
        },
      };
    if (!spaceAwayChanges(state, command.payload.present))
      return {
        ok: false,
        error: { type: ROOM_ERROR_TYPE.conflict, reason: 'presence unchanged' },
      };
    return {
      ok: true,
      events: [
        SpaceAwayChanged({
          away: nextSpaceAway(state, command.payload.present, ctx.ts),
        }),
      ],
    };
  });
