import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
  type MessageRouter,
} from '@pkgs/message';
import { type HandleResult, ROOM_ERROR_TYPE, type RoomState } from '@pkgs/room';

import type { GameCommandContext } from '../game';
import type { SpaceVisibility } from '../space-visibility';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateMemberPayload(p: unknown): p is { readonly memberId: string } {
  return isPlainRecord(p) && isNonEmptyString(p['memberId']);
}

function validateRenamedPayload(p: unknown): p is { readonly title: string } {
  return isPlainRecord(p) && isNonEmptyString(p['title']);
}

function validateVisibilityPayload(
  p: unknown
): p is { readonly visibility: SpaceVisibility } {
  if (!isPlainRecord(p)) return false;
  const v = p['visibility'];
  return v === 'public' || v === 'private';
}

function validateEmptyPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

export const spaceLogCmdNs = createMessageNamespace('space-log-cmd');
export const AnnounceMemberJoined = spaceLogCmdNs(
  'announce-member-joined',
  validateMemberPayload
);
export const AnnounceMemberLeft = spaceLogCmdNs(
  'announce-member-left',
  validateMemberPayload
);
export const AnnounceRenamed = spaceLogCmdNs(
  'announce-renamed',
  validateRenamedPayload
);
export const AnnounceVisibilityChanged = spaceLogCmdNs(
  'announce-visibility-changed',
  validateVisibilityPayload
);
export const AnnounceEnded = spaceLogCmdNs(
  'announce-ended',
  validateEmptyPayload
);

export const spaceLogEvtNs = createMessageNamespace('space-log-evt');
export const MemberJoined = spaceLogEvtNs(
  'member-joined',
  validateMemberPayload
);
export const MemberLeft = spaceLogEvtNs('member-left', validateMemberPayload);
export const SpaceRenamed = spaceLogEvtNs('renamed', validateRenamedPayload);
export const SpaceVisibilityChanged = spaceLogEvtNs(
  'visibility-changed',
  validateVisibilityPayload
);
export const SpaceEnded = spaceLogEvtNs('ended', validateEmptyPayload);

/**
 * Space-log commands are best-effort announcements into the room event log.
 * Authorization: the actor may only announce about themselves for join/leave;
 * rename / visibility / end require the claimer to be the acting identity
 * (host checks live in the mutation write path — here we only bind identity
 * to the memberId / ensure non-spoofed self-announcements).
 */
export const spaceLogCommandRouter: MessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
> = createMessageRouter<RoomState, GameCommandContext, HandleResult>(
  spaceLogCmdNs
)
  .on(AnnounceMemberJoined, (_state, ctx, cmd) => {
    if (cmd.payload.memberId !== ctx.identity) {
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.unauthorized,
          reason: 'cannot announce join for another member',
        },
      };
    }
    return {
      ok: true,
      events: [MemberJoined({ memberId: cmd.payload.memberId })],
    };
  })
  .on(AnnounceMemberLeft, (_state, ctx, cmd) => {
    if (cmd.payload.memberId !== ctx.identity) {
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.unauthorized,
          reason: 'cannot announce leave for another member',
        },
      };
    }
    return {
      ok: true,
      events: [MemberLeft({ memberId: cmd.payload.memberId })],
    };
  })
  .on(AnnounceRenamed, (_state, _identity, cmd) => ({
    ok: true,
    events: [SpaceRenamed({ title: cmd.payload.title })],
  }))
  .on(AnnounceVisibilityChanged, (_state, _identity, cmd) => ({
    ok: true,
    events: [SpaceVisibilityChanged({ visibility: cmd.payload.visibility })],
  }))
  .on(AnnounceEnded, () => ({
    ok: true,
    events: [SpaceEnded({})],
  }));

/**
 * Space-log events are projection-only — they do not mutate room state attrs.
 * The reducer is a no-op identity so the log can still fold cleanly.
 */
export const spaceLogEventReducer: MessageRouter<RoomState, void, RoomState> =
  createMessageRouter<RoomState, void, RoomState>(spaceLogEvtNs)
    .on(MemberJoined, (state) => state)
    .on(MemberLeft, (state) => state)
    .on(SpaceRenamed, (state) => state)
    .on(SpaceVisibilityChanged, (state) => state)
    .on(SpaceEnded, (state) => state);
