import { createAttrNamespace } from '@pkgs/attribute';
import {
  createMessageNamespace,
  isMessageEnvelope,
  isPlainRecord,
  type Message,
} from '@pkgs/message';

import {
  assertRoomModuleName,
  type HandleResult,
  hashRoomState,
  ROOM_ERROR_TYPE,
  type RoomCommand,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';

const ns = createAttrNamespace('authz');
const ownerAttr = ns.textOrNull('owner', (v): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null
);
const countAttr = ns.integer('count', (v): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
);

const cmdNs = createMessageNamespace('authz-cmd');
const Claim = cmdNs(
  'claim',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);
const Bump = cmdNs(
  'bump',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);

const evtNs = createMessageNamespace('authz-evt');
const Claimed = evtNs(
  'claimed',
  (p): p is { owner: string } =>
    isPlainRecord(p) && typeof p['owner'] === 'string' && p['owner'].length > 0
);
const Bumped = evtNs(
  'bumped',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);

function rejectUnauthorized(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.unauthorized, reason } };
}

function rejectInvalid(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.invalidCommand, reason },
  };
}

function rejectConflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

/**
 * Fixture for M5/E7: first Claim sets owner; only owner may Bump.
 */
export const AuthzFixtureModule: RoomModule<
  RoomState,
  Message,
  Message,
  string
> = {
  name: assertRoomModuleName('authz-fixture'),
  initialState(): RoomState {
    return { ...ownerAttr(null), ...countAttr(0) };
  },

  handle(
    state: RoomState,
    command: RoomCommand,
    identity: string
  ): HandleResult {
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) return rejectInvalid('not a message envelope');
    if (Claim.is(msg)) {
      if (ownerAttr.from(state) !== null) {
        return rejectConflict('already claimed');
      }
      return { ok: true, events: [Claimed({ owner: identity })] };
    }
    if (Bump.is(msg)) {
      const owner = ownerAttr.from(state);
      if (owner === null) return rejectConflict('unclaimed');
      if (owner !== identity) return rejectUnauthorized('not owner');
      return { ok: true, events: [Bumped({})] };
    }
    return rejectInvalid(String(msg.type));
  },

  reduce(state: RoomState, event: Message): RoomState {
    const ev = isMessageEnvelope(event) ? event : null;
    if (ev === null) return state;
    if (Claimed.is(ev)) {
      return { ...state, ...ownerAttr(ev.payload.owner) };
    }
    if (Bumped.is(ev)) {
      return { ...state, ...countAttr(countAttr.from(state) + 1) };
    }
    return state;
  },

  hash(state: RoomState): string {
    return hashRoomState(state);
  },
};

export { Bump, Claim, countAttr, ownerAttr };

export function authzCount(state: RoomState): number {
  return countAttr.from(state);
}

export function authzOwner(state: RoomState): string | null {
  return ownerAttr.from(state);
}
