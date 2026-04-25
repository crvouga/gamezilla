import { Assert } from '@gamezilla/lib/assert';
import {
  assertCommand,
  assertLogEntryArray,
  assertSnapshot,
} from '../peer-store-persistence/assert-durable-json';
import type { WireMessage } from './wire-protocol';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export function parseProposeWire(
  msg: Record<string, unknown>,
): WireMessage & { kind: 'propose' } {
  return { kind: 'propose', command: assertCommand(msg['command']) };
}

export function parseAcceptedWire(
  msg: Record<string, unknown>,
): WireMessage & { kind: 'accepted' } {
  const commandId = msg['commandId'];
  crash.string(commandId, 'accepted.commandId must be a string');
  return {
    kind: 'accepted',
    commandId,
    entries: assertLogEntryArray(msg['entries']),
  };
}

function coerceErrorPayload(rawPayload: unknown): unknown {
  if (rawPayload === undefined) return {};
  if (
    rawPayload === null ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  ) {
    return {};
  }
  return rawPayload;
}

export function parseRejectedWire(
  msg: Record<string, unknown>,
): WireMessage & { kind: 'rejected' } {
  const commandId = msg['commandId'];
  crash.string(commandId, 'rejected.commandId must be a string');
  const errObj = msg['error'];
  crash.record(errObj, 'rejected.error must be a plain object');
  const errRec = errObj as Record<string, unknown>;
  const type = errRec['type'];
  crash.string(type, 'rejected.error.type must be a string');
  validation.nonEmptyString(type, 'rejected.error.type must be non-empty');
  const payload = coerceErrorPayload(errRec['payload']);
  return { kind: 'rejected', commandId, error: { type, payload } };
}

export function parseSyncRequestWire(
  msg: Record<string, unknown>,
): WireMessage & { kind: 'sync-request' } {
  const from = msg['from'];
  crash.string(from, 'sync-request.from must be a string');
  const rawSince = msg['sinceSeq'];
  const sinceSeq =
    typeof rawSince === 'number' && Number.isFinite(rawSince)
      ? Math.max(0, Math.floor(rawSince))
      : 0;
  const syncSessionId = msg['syncSessionId'];
  crash.string(syncSessionId, 'sync-request.syncSessionId must be a string');
  validation.nonEmptyString(
    syncSessionId,
    'sync-request.syncSessionId must be non-empty',
  );
  return { kind: 'sync-request', from, sinceSeq, syncSessionId };
}

export function parseSyncResponseWire(
  msg: Record<string, unknown>,
): WireMessage & { kind: 'sync-response' } {
  const to = msg['to'];
  crash.string(to, 'sync-response.to must be a string');
  const baseSeqRaw = msg['baseSeq'];
  crash.number(baseSeqRaw, 'sync-response.baseSeq must be a finite number');
  const snapshot = assertSnapshot(msg['snapshot']);
  const prefixRaw = msg['prefix'];
  const prefix =
    prefixRaw === undefined ? [] : assertLogEntryArray(prefixRaw);
  const syncSessionId = msg['syncSessionId'];
  crash.string(syncSessionId, 'sync-response.syncSessionId must be a string');
  validation.nonEmptyString(
    syncSessionId,
    'sync-response.syncSessionId must be non-empty',
  );
  return {
    kind: 'sync-response',
    to,
    snapshot,
    baseSeq: baseSeqRaw,
    syncSessionId,
    prefix,
    entries: assertLogEntryArray(msg['entries']),
  };
}
