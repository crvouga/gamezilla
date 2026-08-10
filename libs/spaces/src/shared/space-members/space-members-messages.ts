import { createAttrNamespace } from '@pkgs/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
  type MessageRouter,
} from '@pkgs/message';
import { type HandleResult, ROOM_ERROR_TYPE, type RoomState } from '@pkgs/room';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateMemberPayload(p: unknown): p is { readonly memberId: string } {
  return isPlainRecord(p) && isNonEmptyString(p['memberId']);
}

export type SpaceSeat = {
  readonly joinedAt: string;
};

export type SpaceSeatsMap = Readonly<Record<string, SpaceSeat>>;

function parseSeats(v: unknown): SpaceSeatsMap {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, SpaceSeat> = {};
  for (const [memberId, seat] of Object.entries(v)) {
    if (!isNonEmptyString(memberId)) continue;
    if (!isPlainRecord(seat)) continue;
    const joinedAt = seat['joinedAt'];
    if (!isNonEmptyString(joinedAt)) continue;
    out[memberId] = { joinedAt };
  }
  return out;
}

const seatsNs = createAttrNamespace('space', 'members');

/** Durable session seats in {@link RoomState} (not Postgres). */
export const SpaceMembersRoomAttr = {
  seats: seatsNs.json('seats', parseSeats),
} as const;

export const spaceMembersCmdNs = createMessageNamespace('space-members-cmd');
export const JoinSpaceSeat = spaceMembersCmdNs(
  'join-seat',
  validateMemberPayload
);
export const LeaveSpaceSeat = spaceMembersCmdNs(
  'leave-seat',
  validateMemberPayload
);

export const spaceMembersEvtNs = createMessageNamespace('space-members-evt');
export const SpaceSeatJoined = spaceMembersEvtNs(
  'seat-joined',
  validateMemberPayload
);
export const SpaceSeatLeft = spaceMembersEvtNs(
  'seat-left',
  validateMemberPayload
);

function readSeats(state: RoomState): SpaceSeatsMap {
  return SpaceMembersRoomAttr.seats.from(state);
}

export const spaceMembersCommandRouter: MessageRouter<
  RoomState,
  string,
  HandleResult
> = createMessageRouter<RoomState, string, HandleResult>(spaceMembersCmdNs)
  .on(JoinSpaceSeat, (_state, identity, cmd) => {
    if (cmd.payload.memberId !== identity) {
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.unauthorized,
          reason: 'cannot join seat for another member',
        },
      };
    }
    return {
      ok: true,
      events: [SpaceSeatJoined({ memberId: cmd.payload.memberId })],
    };
  })
  .on(LeaveSpaceSeat, (_state, identity, cmd) => {
    if (cmd.payload.memberId !== identity) {
      return {
        ok: false,
        error: {
          type: ROOM_ERROR_TYPE.unauthorized,
          reason: 'cannot leave seat for another member',
        },
      };
    }
    return {
      ok: true,
      events: [SpaceSeatLeft({ memberId: cmd.payload.memberId })],
    };
  });

export function createSpaceMembersEventReducer(
  now: () => number
): MessageRouter<RoomState, void, RoomState> {
  return createMessageRouter<RoomState, void, RoomState>(spaceMembersEvtNs)
    .on(SpaceSeatJoined, (state, _ctx, evt) => {
      const seats = { ...readSeats(state) };
      if (seats[evt.payload.memberId] === undefined) {
        seats[evt.payload.memberId] = {
          joinedAt: new Date(now()).toISOString(),
        };
      }
      return { ...state, ...SpaceMembersRoomAttr.seats(seats) };
    })
    .on(SpaceSeatLeft, (state, _ctx, evt) => {
      const seats = { ...readSeats(state) };
      delete seats[evt.payload.memberId];
      return { ...state, ...SpaceMembersRoomAttr.seats(seats) };
    });
}

export function spaceSeatMemberIds(state: RoomState): readonly string[] {
  // Explicit sort: plain-object key order is not a stable roster / turn order
  // (integer-like ids reorder per the JS property-order rules).
  return Object.keys(readSeats(state)).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );
}

export function spaceSeatCount(state: RoomState): number {
  return spaceSeatMemberIds(state).length;
}
