import type { LogEntry, RoomCommandPayload, RoomError } from '../types';

export const WIRE_VERSION = 1 as const;

export type ClientToServerWire =
  | {
      v: typeof WIRE_VERSION;
      kind: 'command';
      id: string;
      ts: number;
      payload: RoomCommandPayload;
    }
  | { v: typeof WIRE_VERSION; kind: 'sync'; fromSeq: number }
  | { v: typeof WIRE_VERSION; kind: 'ping' };

export type ServerToClientWire =
  | {
      v: typeof WIRE_VERSION;
      kind: 'welcome';
      fromSeq: number;
      lastSeq: number;
      entries: LogEntry[];
    }
  | {
      v: typeof WIRE_VERSION;
      kind: 'committed';
      commandId?: string;
      entries: LogEntry[];
    }
  | {
      v: typeof WIRE_VERSION;
      kind: 'rejected';
      commandId: string;
      error: RoomError;
    };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function parseClientPing(kind: unknown): ClientToServerWire | null {
  return kind === 'ping' ? { v: WIRE_VERSION, kind: 'ping' } : null;
}

function parseClientSync(
  raw: Record<string, unknown>
): ClientToServerWire | null {
  const fromSeq = raw['fromSeq'];
  if (typeof fromSeq !== 'number' || !Number.isFinite(fromSeq) || fromSeq < 0) {
    return null;
  }
  return { v: WIRE_VERSION, kind: 'sync', fromSeq: Math.floor(fromSeq) };
}

function parseClientCommand(
  raw: Record<string, unknown>
): ClientToServerWire | null {
  const id = raw['id'];
  const ts = raw['ts'];
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  if (!('payload' in raw)) return null;
  return {
    v: WIRE_VERSION,
    kind: 'command',
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
  return (
    parseClientPing(kind) ??
    (kind === 'sync' ? parseClientSync(raw) : null) ??
    (kind === 'command' ? parseClientCommand(raw) : null)
  );
}

function parseWelcomeWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const fromSeq = raw['fromSeq'];
  const lastSeq = raw['lastSeq'];
  const entries = raw['entries'];
  if (typeof fromSeq !== 'number' || !Number.isFinite(fromSeq)) return null;
  if (typeof lastSeq !== 'number' || !Number.isFinite(lastSeq)) return null;
  if (!Array.isArray(entries)) return null;
  return {
    v: WIRE_VERSION,
    kind: 'welcome',
    fromSeq: Math.floor(fromSeq),
    lastSeq: Math.floor(lastSeq),
    entries: entries as LogEntry[],
  };
}

function parseCommittedWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const entries = raw['entries'];
  if (!Array.isArray(entries)) return null;
  const commandId = raw['commandId'];
  if (commandId !== undefined && typeof commandId !== 'string') return null;
  return {
    v: WIRE_VERSION,
    kind: 'committed',
    ...(typeof commandId === 'string' && commandId.length > 0
      ? { commandId }
      : {}),
    entries: entries as LogEntry[],
  };
}

function parseRejectedWire(
  raw: Record<string, unknown>
): ServerToClientWire | null {
  const commandId = raw['commandId'];
  const error = raw['error'];
  if (typeof commandId !== 'string' || commandId.length === 0) return null;
  if (!isRecord(error)) return null;
  if (typeof error['type'] !== 'string') return null;
  return {
    v: WIRE_VERSION,
    kind: 'rejected',
    commandId,
    error: error as RoomError,
  };
}

export function parseServerToClientWire(
  raw: unknown
): ServerToClientWire | null {
  if (!isRecord(raw) || raw['v'] !== WIRE_VERSION) return null;
  const kind = raw['kind'];
  if (kind === 'welcome') return parseWelcomeWire(raw);
  if (kind === 'committed') return parseCommittedWire(raw);
  if (kind === 'rejected') return parseRejectedWire(raw);
  return null;
}
