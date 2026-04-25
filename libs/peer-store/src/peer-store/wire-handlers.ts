import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../event-log/log-entry';
import { peerNamespace } from '../protocol/system-messages';
import { isSystemEvent } from '../protocol/utils';
import {
  checkAuthorityChange,
  updateLastSeenFromRecord,
} from './authority-monitor';
import {
  applyMembershipEvent,
  materializeAtSeq,
} from './membership';
import type { PeerStore } from './peer-store';
import type { Command, StoreEffect } from './peer-store-types';
import {
  parseAcceptedWire,
  parseProposeWire,
  parseRejectedWire,
  parseSyncRequestWire,
  parseSyncResponseWire,
} from './wire-parsers';
import type { WireMessage } from './wire-protocol';

const crash: Assert = Assert.crash();

export function handleWireMessage(self: PeerStore, payload: unknown): void {
  if (self.is_destroyed) return;
  crash.record(payload, 'wire message must be an object');
  const msg = payload;
  const kindRaw = msg['kind'];
  crash.string(kindRaw, 'wire message must have a kind string');

  updateLastSeenFromRecord(self, msg);
  checkAuthorityChange(self);

  dispatchWireKind(self, kindRaw, msg);
}

function dispatchWireKind(
  self: PeerStore,
  kindRaw: string,
  msg: Record<string, unknown>,
): void {
  switch (kindRaw) {
    case 'propose':
      handleProposeWire(self, parseProposeWire(msg));
      break;
    case 'accepted':
      handleAcceptedWire(self, parseAcceptedWire(msg));
      break;
    case 'rejected':
      handleRejectedWire(self, parseRejectedWire(msg));
      break;
    case 'sync-request':
      handleSyncRequestWire(self, parseSyncRequestWire(msg));
      break;
    case 'sync-response':
      handleSyncResponseWire(self, parseSyncResponseWire(msg));
      break;
    default:
      break;
  }
}

export function handleProposeWire(
  self: PeerStore,
  wire: WireMessage & { kind: 'propose' },
): void {
  if (!self.isAuthority()) return;
  const { command } = wire;
  if (command.peerId === self.peerId) return;
  if (self.finalized_command_ids.has(command.id)) return;

  if (peerNamespace.owns(command.message)) {
    handleProposeSystem(self, command);
    return;
  }
  handleProposeDomain(self, command);
}

function handleProposeSystem(self: PeerStore, command: Command): void {
  const sys = self.evaluateSystemCommand(command);
  if (sys.ok) {
    handleCommitEntries(self, command.id, sys.entries);
    self.transport.publish(self.topic, {
      kind: 'accepted',
      commandId: command.id,
      entries: sys.entries,
    } satisfies WireMessage);
  } else {
    self.finalized_command_ids.add(command.id);
    self.transport.publish(self.topic, {
      kind: 'rejected',
      commandId: command.id,
      error: sys.error,
    } satisfies WireMessage);
  }
}

function handleProposeDomain(self: PeerStore, command: Command): void {
  const evaluated = self.authorityEvaluateDomain(command);
  if (evaluated.ok) {
    const entries = evaluated.entries;
    handleCommitEntries(self, command.id, entries, evaluated.effects);
    self.transport.publish(self.topic, {
      kind: 'accepted',
      commandId: command.id,
      entries,
    } satisfies WireMessage);
  } else {
    self.finalized_command_ids.add(command.id);
    self.transport.publish(self.topic, {
      kind: 'rejected',
      commandId: command.id,
      error: evaluated.error,
    } satisfies WireMessage);
  }
}

export function handleAcceptedWire(
  self: PeerStore,
  wire: WireMessage & { kind: 'accepted' },
): void {
  const { commandId, entries } = wire;
  crash.array(entries, 'accepted must include entries array');
  handleCommitEntries(self, commandId, entries);
}

export function handleRejectedWire(
  self: PeerStore,
  wire: WireMessage & { kind: 'rejected' },
): void {
  const { commandId } = wire;
  if (self.finalized_command_ids.has(commandId)) return;
  self.finalized_command_ids.add(commandId);

  self.optimistic_events = self.optimistic_events.filter(
    (e) => e._commandId !== commandId,
  );

  const timeout = self.pending_timeouts.get(commandId);
  if (timeout !== undefined) {
    clearTimeout(timeout);
    self.pending_timeouts.delete(commandId);
  }

  self.callbacks.onReject?.(commandId);
  self.notifySubscribers();
}

function applyCommitEntry(self: PeerStore, entry: LogEntry): void {
  const { event } = entry;
  if (isSystemEvent(event)) {
    applyMembershipEvent(self.membership, event);
    return;
  }
  self.committed_state = self.module.reduce(self.committed_state, event);
  crash.record(
    self.committed_state,
    'reduce must return a plain object after commit',
  );
}

export function handleCommitEntries(
  self: PeerStore,
  commandId: string,
  entries: LogEntry[],
  effects?: StoreEffect[],
): void {
  if (self.finalized_command_ids.has(commandId)) return;
  self.finalized_command_ids.add(commandId);

  let expectNext = self.last_committed_log_seq + 1;
  for (const entry of entries) {
    crash.ok(
      entry.seq === expectNext,
      'commit entries must have consecutive global seq',
      { expectNext, got: entry.seq },
    );
    expectNext++;
    applyCommitEntry(self, entry);
    self.committed_entries.push(entry);
    self.last_committed_log_seq = entry.seq;
  }

  self.rebuildAuthorityFromMembership();

  self.optimistic_events = self.optimistic_events.filter(
    (e) => e._commandId !== commandId,
  );

  const timeout = self.pending_timeouts.get(commandId);
  if (timeout !== undefined) {
    clearTimeout(timeout);
    self.pending_timeouts.delete(commandId);
  }

  self.callbacks.onCommit?.(commandId, entries, effects);
  self.notifySubscribers();
}

export function handleSyncRequestWire(
  self: PeerStore,
  wire: WireMessage & { kind: 'sync-request' },
): void {
  if (wire.from === self.peerId) return;
  if (!self.isAuthority()) return;

  const sinceSeq =
    typeof wire.sinceSeq === 'number' && Number.isFinite(wire.sinceSeq)
      ? Math.max(0, Math.floor(wire.sinceSeq))
      : 0;

  const snapshot = materializeAtSeq(
    self.module,
    self.committed_entries,
    sinceSeq,
  );
  const prefix = self.committed_entries.filter((e) => e.seq <= sinceSeq);
  const tail = self.committed_entries.filter((e) => e.seq > sinceSeq);

  self.transport.publish(self.topic, {
    kind: 'sync-response',
    to: wire.from,
    snapshot,
    baseSeq: sinceSeq,
    prefix,
    entries: tail,
  } satisfies WireMessage);
}

export function handleSyncResponseWire(
  self: PeerStore,
  wire: WireMessage & { kind: 'sync-response' },
): void {
  if (wire.to !== self.peerId) return;
  if (!self.sync_pending) return;
  self.sync_pending = false;

  const baseSeq =
    typeof wire.baseSeq === 'number' && Number.isFinite(wire.baseSeq)
      ? wire.baseSeq
      : 0;
  const snap = wire.snapshot;
  crash.defined(snap, 'sync-response must include snapshot');
  crash.ok(snap.seq === baseSeq, 'snapshot.seq must equal baseSeq');

  const prefix = Array.isArray(wire.prefix) ? wire.prefix : [];
  const tail = Array.isArray(wire.entries) ? wire.entries : [];
  const full = [...prefix, ...tail].sort((a, b) => a.seq - b.seq);
  self.rehydrate(full);

  self.synced = true;
  self.callbacks.onSync?.();
}
