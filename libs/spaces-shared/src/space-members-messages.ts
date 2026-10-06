import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import type { MessageRouter } from '@pkgs/message-shared/router';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { RoomState } from '@pkgs/room-root-shared/types';

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

/** When each seated member stopped being present (room time, ms). */
export type SpaceAwayMap = Readonly<Record<string, number>>;

function parseAway(v: unknown): SpaceAwayMap {
  if (!isPlainRecord(v)) return {};
  const out: Record<string, number> = {};
  for (const [memberId, since] of Object.entries(v))
    if (
      isNonEmptyString(memberId) &&
      typeof since === 'number' &&
      Number.isInteger(since) &&
      since >= 0
    )
      out[memberId] = since;
  return out;
}

/**
 * Pairs of members who may not play together because one blocked the other,
 * each written low id first, so the room never says who blocked whom.
 */
export type SpaceRestrictions = readonly (readonly [string, string])[];

function isPair(v: unknown): v is readonly [string, string] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    isNonEmptyString(v[0]) &&
    isNonEmptyString(v[1])
  );
}

function parseRestrictions(v: unknown): SpaceRestrictions {
  return Array.isArray(v) ? v.filter(isPair) : [];
}

/** Undirected, ordered and distinct: what the room keeps of a set of blocks. */
export function spaceRestrictionPairs(
  blocks: readonly (readonly [string, string])[]
): SpaceRestrictions {
  const keys = new Set(
    blocks.map(([a, b]) => (a < b ? `${a}\n${b}` : `${b}\n${a}`))
  );
  return [...keys].sort().map((key) => {
    const [low = '', high = ''] = key.split('\n');
    return [low, high] as const;
  });
}

const seatsNs = createAttrNamespace('space', 'members');

/** Durable session seats in {@link RoomState} (not Postgres). */
export const SpaceMembersRoomAttr = {
  seats: seatsNs.json('seats', parseSeats),
  ended: seatsNs.boolean('ended', (value) => value === true),
  /** Seated members with no live connection to the room, and since when. */
  away: seatsNs.json('away', parseAway),
  /** Who may not play together, from the friends context's blocks. */
  restrictions: seatsNs.array('restrictions', parseRestrictions),
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
/** Who of the seated members is away now, each with the time they went. */
export const SpaceAwayChanged = spaceMembersEvtNs(
  'away-changed',
  (p): p is { readonly away: SpaceAwayMap } =>
    isPlainRecord(p) &&
    isPlainRecord(p['away']) &&
    Object.keys(parseAway(p['away'])).length === Object.keys(p['away']).length
);
/** The blocks among the members, replacing the previous ones. */
export const SpaceRestrictionsChanged = spaceMembersEvtNs(
  'restrictions-changed',
  (p): p is { readonly pairs: SpaceRestrictions } =>
    isPlainRecord(p) && Array.isArray(p['pairs']) && p['pairs'].every(isPair)
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
      const away = { ...SpaceMembersRoomAttr.away.from(state) };
      const wasAway = Object.hasOwn(away, evt.payload.memberId);
      delete away[evt.payload.memberId];
      return {
        ...state,
        ...SpaceMembersRoomAttr.seats(seats),
        ...(wasAway ? SpaceMembersRoomAttr.away(away) : {}),
      };
    })
    .on(SpaceAwayChanged, (state, _ctx, evt) => ({
      ...state,
      ...SpaceMembersRoomAttr.away(evt.payload.away),
    }))
    .on(SpaceRestrictionsChanged, (state, _ctx, evt) => ({
      ...state,
      ...SpaceMembersRoomAttr.restrictions(evt.payload.pairs),
    }));
}

/** Whether one of two members has blocked the other. */
export function spaceMembersRestricted(
  state: RoomState,
  a: string,
  b: string
): boolean {
  return SpaceMembersRoomAttr.restrictions
    .from(state)
    .some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Since when a seated member has been away, or `null` while present. */
export function spaceMemberAwaySince(
  state: RoomState,
  memberId: string
): number | null {
  return SpaceMembersRoomAttr.away.from(state)[memberId] ?? null;
}

/**
 * Who of the seated members is away given the members present now: those
 * already away keep the time they went, newly absent members go at `now`.
 */
export function nextSpaceAway(
  state: RoomState,
  present: readonly string[],
  now: number
): SpaceAwayMap {
  const away = SpaceMembersRoomAttr.away.from(state);
  const next: Record<string, number> = {};
  for (const memberId of spaceSeatMemberIds(state))
    if (!present.includes(memberId)) next[memberId] = away[memberId] ?? now;
  return next;
}

/** Whether the members present now change who is away. */
export function spaceAwayChanges(
  state: RoomState,
  present: readonly string[]
): boolean {
  if (SpaceMembersRoomAttr.ended.from(state)) return false;
  const away = Object.keys(SpaceMembersRoomAttr.away.from(state)).sort();
  const next = Object.keys(nextSpaceAway(state, present, 0)).sort();
  return away.join('\n') !== next.join('\n');
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
