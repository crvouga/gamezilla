import { Assert } from '@gamezilla/lib/assert';
import { createMessageRouter, type MessageRouter } from '@gamezilla/lib/message';
import type { LogEntry } from '../persistence/log-entry';
import type { Event } from '../events/message-types';
import {
  RoomDuplicatePeer,
  RoomJoinInvalid,
  RoomJoinPeerMismatch,
  RoomLeaveInvalid,
  RoomLeaveNotSelf,
  RoomNotAuthority,
  RoomTrustInvalid,
  RoomUnknownPeer,
} from '../events/room-errors';
import {
  PeerJoin,
  PeerJoined,
  PeerLeave,
  PeerLeft,
  peerNamespace,
  PeerTrustUpdate,
  PeerTrustUpdated,
} from '../events/system-messages';
import { decodeKeyB64, peerIdFromPublicKey } from './security/peer-crypto';
import type { Command } from './types';
import type { SystemCommandEvalResult } from './wire-protocol';

const crash: Assert = Assert.crash();

/**
 * Minimal context required by the system-command router. Room provides
 * an adapter implementing this interface so the router stays free of the
 * larger class surface.
 */
export type SystemRouterContext = {
  hasMember(peerId: string): boolean;
  isAuthority(peerId: string): boolean;
  allocateEntriesFromEvents(events: Event[]): LogEntry[];
};

type ParsedJoinPayload = { peerId: string; trust: number; publicKey: string };
type ParsedLeavePayload = { peerId: string };
type ParsedTrustPayload = { peerId: string; trust: number };

type ParseOk<T> = { ok: true; value: T };
type ParseErr = { ok: false; error: SystemCommandEvalResult };
type ParseResult<T> = ParseOk<T> | ParseErr;

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw);
}

function isFiniteTrust(trust: unknown): trust is number {
  return typeof trust === 'number' && trust >= 0 && Number.isFinite(trust);
}

function parseJoinPayload(raw: unknown): ParseResult<ParsedJoinPayload> {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomJoinInvalid({
          detail: 'join payload must be a plain object',
        }),
      },
    };
  }
  crash.record(raw, 'join payload must be a plain object');
  const peerId = raw['peerId'];
  const trust = raw['trust'];
  const publicKey = raw['publicKey'];
  if (!peerId || typeof peerId !== 'string') {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomJoinInvalid({
          detail: 'join payload requires peerId string',
        }),
      },
    };
  }
  if (!isFiniteTrust(trust)) {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomJoinInvalid({
          detail: 'join payload requires finite trust >= 0',
        }),
      },
    };
  }
  if (!publicKey || typeof publicKey !== 'string') {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomJoinInvalid({
          detail: 'join payload requires publicKey string',
        }),
      },
    };
  }
  return { ok: true, value: { peerId, trust, publicKey } };
}

function parseLeavePayload(raw: unknown): ParseResult<ParsedLeavePayload> {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomLeaveInvalid({
          detail: 'leave payload must be a plain object',
        }),
      },
    };
  }
  crash.record(raw, 'leave payload must be a plain object');
  const peerId = raw['peerId'];
  if (!peerId || typeof peerId !== 'string') {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomLeaveInvalid({
          detail: 'leave payload requires peerId',
        }),
      },
    };
  }
  return { ok: true, value: { peerId } };
}

function parseTrustPayload(raw: unknown): ParseResult<ParsedTrustPayload> {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomTrustInvalid({
          detail: 'trust_update payload must be a plain object',
        }),
      },
    };
  }
  crash.record(raw, 'trust_update payload must be a plain object');
  const peerId = raw['peerId'];
  const trust = raw['trust'];
  if (!peerId || typeof peerId !== 'string') {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomTrustInvalid({
          detail: 'trust_update requires peerId',
        }),
      },
    };
  }
  if (!isFiniteTrust(trust)) {
    return {
      ok: false,
      error: {
        ok: false,
        error: RoomTrustInvalid({
          detail: 'trust_update requires finite trust >= 0',
        }),
      },
    };
  }
  return { ok: true, value: { peerId, trust } };
}

function evaluatePeerJoin(
  ctx: SystemRouterContext,
  command: Command,
  rawPayload: unknown,
): SystemCommandEvalResult {
  const parsed = parseJoinPayload(rawPayload);
  if (!parsed.ok) return parsed.error;
  const { peerId, trust, publicKey } = parsed.value;
  if (peerId !== command.peerId) {
    return {
      ok: false,
      error: RoomJoinPeerMismatch({
        detail: 'join peerId must match command.peerId',
      }),
    };
  }
  let pubBytes: Uint8Array;
  try {
    pubBytes = decodeKeyB64(publicKey);
  } catch {
    return {
      ok: false,
      error: RoomJoinInvalid({
        detail: 'join payload publicKey is not valid base64url 32-byte key',
      }),
    };
  }
  let derived: string;
  try {
    derived = peerIdFromPublicKey(pubBytes);
  } catch {
    return {
      ok: false,
      error: RoomJoinInvalid({
        detail: 'join payload publicKey could not derive peerId',
      }),
    };
  }
  if (derived !== peerId) {
    return {
      ok: false,
      error: RoomJoinInvalid({
        detail: 'join peerId must equal peerId derived from publicKey',
      }),
    };
  }
  if (ctx.hasMember(peerId)) {
    return { ok: false, error: RoomDuplicatePeer({ peerId }) };
  }
  return {
    ok: true,
    entries: ctx.allocateEntriesFromEvents([
      PeerJoined({ peerId, trust, publicKey }),
    ]),
  };
}

function evaluatePeerLeave(
  ctx: SystemRouterContext,
  command: Command,
  rawPayload: unknown,
): SystemCommandEvalResult {
  const parsed = parseLeavePayload(rawPayload);
  if (!parsed.ok) return parsed.error;
  const { peerId } = parsed.value;
  if (peerId !== command.peerId) {
    return {
      ok: false,
      error: RoomLeaveNotSelf({ detail: 'leave only allowed for self' }),
    };
  }
  if (!ctx.hasMember(peerId)) {
    return { ok: false, error: RoomUnknownPeer({ peerId }) };
  }
  return {
    ok: true,
    entries: ctx.allocateEntriesFromEvents([PeerLeft({ peerId })]),
  };
}

function evaluatePeerTrustUpdate(
  ctx: SystemRouterContext,
  command: Command,
  rawPayload: unknown,
): SystemCommandEvalResult {
  const parsed = parseTrustPayload(rawPayload);
  if (!parsed.ok) return parsed.error;
  const { peerId, trust } = parsed.value;
  if (!ctx.isAuthority(command.peerId)) {
    return { ok: false, error: RoomNotAuthority({}) };
  }
  if (!ctx.hasMember(peerId)) {
    return { ok: false, error: RoomUnknownPeer({ peerId }) };
  }
  return {
    ok: true,
    entries: ctx.allocateEntriesFromEvents([
      PeerTrustUpdated({ peerId, trust }),
    ]),
  };
}

export function createSystemCommandRouter(): MessageRouter<
  SystemRouterContext,
  Command,
  SystemCommandEvalResult
> {
  return createMessageRouter<SystemRouterContext, Command, SystemCommandEvalResult>(
    peerNamespace,
  )
    .on(PeerJoin, (ctx, command, msg) =>
      evaluatePeerJoin(ctx, command, msg.payload),
    )
    .on(PeerLeave, (ctx, command, msg) =>
      evaluatePeerLeave(ctx, command, msg.payload),
    )
    .on(PeerTrustUpdate, (ctx, command, msg) =>
      evaluatePeerTrustUpdate(ctx, command, msg.payload),
    );
}
