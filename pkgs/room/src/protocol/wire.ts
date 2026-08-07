import { isNamespacedKeyword } from '@pkgs/keyword';
import { isMessageEnvelope } from '@pkgs/message';
import {
  type LogEntry,
  ROOM_ERROR_TYPE,
  ROOM_ERROR_TYPES,
  type RoomActor,
  type RoomCommandPayload,
  type RoomError,
} from '../types';

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isRoomErrorWire(value: unknown): value is RoomError {
  if (!isRecord(value)) return false;
  const t = value['type'];
  if (typeof t !== 'string') return false;
  if (!isNamespacedKeyword(t)) return false;
  if (!ROOM_ERROR_TYPES.has(t)) return false;
  if (t === ROOM_ERROR_TYPE.rateLimited) {
    return true;
  }
  // All other variants carry a `reason` (required for invalid-command,
  // unauthorized, conflict; optional for internal). Be strict on the wire:
  // any non-rate-limited tag must carry a string reason if present.
  if ('reason' in value && typeof value['reason'] !== 'string') return false;
  if (t !== ROOM_ERROR_TYPE.internal && typeof value['reason'] !== 'string') {
    return false;
  }
  return true;
}

function isRoomActorWire(value: unknown): value is RoomActor {
  if (!isRecord(value)) return false;
  const id = value['id'];
  const clientId = value['clientId'];
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof clientId === 'string' &&
    clientId.length > 0
  );
}

function isOptionalActorField(value: Record<string, unknown>): boolean {
  if (!('actor' in value) || value['actor'] === undefined) return true;
  return isRoomActorWire(value['actor']);
}

function isOptionalTsField(value: Record<string, unknown>): boolean {
  if (!('ts' in value) || value['ts'] === undefined) return true;
  const ts = value['ts'];
  return typeof ts === 'number' && Number.isFinite(ts);
}

function isLogEntryWire(value: unknown): value is LogEntry {
  if (!isRecord(value)) return false;
  const seq = value['seq'];
  if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < 0) return false;
  if (!isMessageEnvelope(value['event'])) return false;
  return isOptionalActorField(value) && isOptionalTsField(value);
}

function parseClientPing(): ClientToServerWire {
  return { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.ping };
}

function parseClientSync(
  raw: Record<string, unknown>
): ClientToServerWire | null {
  const fromSeq = raw['fromSeq'];
  if (typeof fromSeq !== 'number' || !Number.isFinite(fromSeq) || fromSeq < 0) {
    return null;
  }
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
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
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
  const kind = raw['kind'];
  if (typeof kind !== 'string') return null;
  if (kind === ROOM_WIRE_KIND.ping) return parseClientPing();
  if (kind === ROOM_WIRE_KIND.sync) return parseClientSync(raw);
  if (kind === ROOM_WIRE_KIND.command) return parseClientCommand(raw);
  return null;
}

function parseEntriesWire(raw: unknown): LogEntry[] | null {
  if (!Array.isArray(raw)) return null;
  for (const e of raw) {
    if (!isLogEntryWire(e)) return null;
  }
  return raw as LogEntry[];
}

function parseWelcomeWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const fromSeq = raw['fromSeq'];
  const lastSeq = raw['lastSeq'];
  if (typeof fromSeq !== 'number' || !Number.isFinite(fromSeq)) return null;
  if (typeof lastSeq !== 'number' || !Number.isFinite(lastSeq)) return null;
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
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.committed,
    ...(typeof commandId === 'string' && commandId.length > 0
      ? { commandId }
      : {}),
    entries,
  };
}

function parseRejectedWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const commandId = raw['commandId'];
  const error = raw['error'];
  if (typeof commandId !== 'string' || commandId.length === 0) return null;
  if (!isRoomErrorWire(error)) return null;
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.rejected,
    commandId,
    error,
  };
}

function parseRosterWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const clients = raw['clients'];
  if (!Array.isArray(clients)) return null;
  for (const c of clients) {
    if (!isRoomActorWire(c)) return null;
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
  const kind = raw['kind'];
  if (typeof kind !== 'string') return null;
  if (kind === ROOM_WIRE_KIND.pong) {
    return { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong };
  }
  if (kind === ROOM_WIRE_KIND.welcome) return parseWelcomeWire(raw);
  if (kind === ROOM_WIRE_KIND.committed) return parseCommittedWire(raw);
  if (kind === ROOM_WIRE_KIND.rejected) return parseRejectedWire(raw);
  if (kind === ROOM_WIRE_KIND.roster) return parseRosterWire(raw);
  return null;
}
