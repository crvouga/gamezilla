import { isNamespacedKeyword } from '@pkgs/keyword-shared/keyword';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import type {
  LogEntry,
  RoomActor,
  RoomCommandPayload,
  RoomError,
} from './types';
import { ROOM_ERROR_TYPE, ROOM_ERROR_TYPES } from './types';

export const WIRE_VERSION = 1 as const;

/**
 * Wire `kind` discriminators. The wire protocol is a **static contract**:
 * the set of envelope kinds is fixed and versioned via {@link WIRE_VERSION},
 * not extended at runtime. So this is just a frozen string-literal map and a
 * rigid discriminated union — no {@link Keyword}/attribute machinery, which
 * is reserved for dynamic app state and message types.
 */
export const ROOM_WIRE_KIND = {
  command: 'command',
  sync: 'sync',
  ping: 'ping',
  pong: 'pong',
  welcome: 'welcome',
  committed: 'committed',
  rejected: 'rejected',
  /** Ephemeral connected-client snapshot; not part of the committed log. */
  roster: 'roster',
} as const;

export type ClientToServerWire =
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.command;
      id: string;
      ts: number;
      payload: RoomCommandPayload;
    }
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.sync;
      fromSeq: number;
    }
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.ping;
    };

export type ServerToClientWire =
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.welcome;
      fromSeq: number;
      lastSeq: number;
      entries: LogEntry[];
    }
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.committed;
      commandId?: string;
      entries: LogEntry[];
    }
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.rejected;
      commandId: string;
      error: RoomError;
    }
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.pong;
    }
  | {
      v: typeof WIRE_VERSION;
      kind: typeof ROOM_WIRE_KIND.roster;
      clients: readonly RoomActor[];
    };

const PING_FRAME: ClientToServerWire = Object.freeze({
  v: WIRE_VERSION,
  kind: ROOM_WIRE_KIND.ping,
});
const PONG_FRAME: ServerToClientWire = Object.freeze({
  v: WIRE_VERSION,
  kind: ROOM_WIRE_KIND.pong,
});

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isRoomErrorWire(value: unknown): value is RoomError {
  if (!isRecord(value)) return false;
  const t = value['type'];
  if (typeof t !== 'string') return false;
  if (!isNamespacedKeyword(t)) return false;
  if (!ROOM_ERROR_TYPES.has(t)) return false;
  if (t === ROOM_ERROR_TYPE.rateLimited) return true;
  // All other variants carry a `reason` (required for invalid-command,
  // unauthorized, conflict; optional for internal). Be strict on the wire:
  // any non-rate-limited tag must carry a string reason if present.
  const reason = value['reason'];
  if (reason === undefined) return t === ROOM_ERROR_TYPE.internal;
  return typeof reason === 'string';
}

function isRoomActorWire(value: unknown): value is RoomActor {
  return (
    isRecord(value) &&
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['clientId'])
  );
}

function isLogEntryWire(value: unknown): value is LogEntry {
  if (!isRecord(value)) return false;
  const seq = value['seq'];
  if (!isFiniteNumber(seq) || seq < 0) return false;
  if (!isMessageEnvelope(value['event'])) return false;
  const actor = value['actor'];
  if (actor !== undefined && !isRoomActorWire(actor)) return false;
  const ts = value['ts'];
  return ts === undefined || isFiniteNumber(ts);
}

function parseClientSync(
  raw: Record<string, unknown>
): ClientToServerWire | null {
  const fromSeq = raw['fromSeq'];
  if (!isFiniteNumber(fromSeq) || fromSeq < 0) return null;
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.sync,
    fromSeq: Math.floor(fromSeq),
  };
}

function parseClientCommand(
  raw: Record<string, unknown>
): ClientToServerWire | null {
  const id = raw['id'];
  const ts = raw['ts'];
  if (!isNonEmptyString(id) || !isFiniteNumber(ts)) return null;
  if (!('payload' in raw)) return null;
  // Note: payload envelope is intentionally not validated here so the server
  // can echo a `rejected` frame to the client when malformed; see
  // `RoomServer.handleParsedCommand`.
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts,
    payload: raw['payload'] as RoomCommandPayload,
  };
}

export function parseClientToServerWire(
  raw: unknown
): ClientToServerWire | null {
  if (!isRecord(raw) || raw['v'] !== WIRE_VERSION) return null;
  switch (raw['kind']) {
    case ROOM_WIRE_KIND.ping:
      return PING_FRAME;
    case ROOM_WIRE_KIND.sync:
      return parseClientSync(raw);
    case ROOM_WIRE_KIND.command:
      return parseClientCommand(raw);
    default:
      return null;
  }
}

function parseEntriesWire(raw: unknown): LogEntry[] | null {
  if (!Array.isArray(raw)) return null;
  for (let i = 0; i < raw.length; i++) {
    if (!isLogEntryWire(raw[i])) return null;
  }
  return raw as LogEntry[];
}

function parseWelcomeWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const fromSeq = raw['fromSeq'];
  const lastSeq = raw['lastSeq'];
  if (!isFiniteNumber(fromSeq) || !isFiniteNumber(lastSeq)) return null;
  const entries = parseEntriesWire(raw['entries']);
  if (entries === null) return null;
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.welcome,
    fromSeq: Math.floor(fromSeq),
    lastSeq: Math.floor(lastSeq),
    entries,
  };
}

function parseCommittedWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const entries = parseEntriesWire(raw['entries']);
  if (entries === null) return null;
  const commandId = raw['commandId'];
  if (commandId !== undefined && typeof commandId !== 'string') return null;
  if (isNonEmptyString(commandId)) {
    return {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId,
      entries,
    };
  }
  return { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.committed, entries };
}

function parseRejectedWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const commandId = raw['commandId'];
  const error = raw['error'];
  if (!isNonEmptyString(commandId) || !isRoomErrorWire(error)) return null;
  return { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.rejected, commandId, error };
}

function parseRosterWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const clients = raw['clients'];
  if (!Array.isArray(clients)) return null;
  for (let i = 0; i < clients.length; i++) {
    if (!isRoomActorWire(clients[i])) return null;
  }
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.roster,
    clients: clients as RoomActor[],
  };
}

export function parseServerToClientWire(
  raw: unknown
): ServerToClientWire | null {
  if (!isRecord(raw) || raw['v'] !== WIRE_VERSION) return null;
  switch (raw['kind']) {
    case ROOM_WIRE_KIND.pong:
      return PONG_FRAME;
    case ROOM_WIRE_KIND.welcome:
      return parseWelcomeWire(raw);
    case ROOM_WIRE_KIND.committed:
      return parseCommittedWire(raw);
    case ROOM_WIRE_KIND.rejected:
      return parseRejectedWire(raw);
    case ROOM_WIRE_KIND.roster:
      return parseRosterWire(raw);
    default:
      return null;
  }
}
