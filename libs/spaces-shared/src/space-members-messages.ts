import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import { createMessageNamespace, isPlainRecord } from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { MessageRouter } from '@pkgs/message-shared/router';
import type { RoomState } from '@pkgs/room-shared/types';

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
  ended: seatsNs.boolean('ended', (value) => value === true),
} as const;

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
