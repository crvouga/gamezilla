import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../persistence/log-entry';
import { decodeKeyB64 } from './security/peer-crypto';
import { PeerJoined, PeerLeave, peerNamespace } from '../protocol/system-messages';
import { isSystemEvent } from '../protocol/utils';
import {
  checkAuthorityChange,
  seedDiscoveredPeerLiveness,
  updateLastSeenVerified,
} from './authority-monitor';
import { applyMembershipEvent, materializeAtSeq } from './membership';
import type { PeerStore } from './peer-store';
import type { Command, StoreEffect } from './peer-store-types';
import type { WireMessage } from './wire-protocol';

const crash: Assert = Assert.crash();

export function handleWireMessage(self: PeerStore, payload: unknown): void {
  if (self.is_destroyed) return;
  const verified = self.verifyInboundWire(payload);
  if (!verified) return;

  updateLastSeenVerified(self, verified.signerPeerId);
  checkAuthorityChange(self, (prev, next) =>
    self.notifyAuthorityElectionLiveness(prev, next),
  );

  dispatchVerifiedBody(self, verified.body);
}

function dispatchVerifiedBody(self: PeerStore, body: WireMessage): void {
  switch (body.kind) {
    case 'propose':
      handleProposeWire(self, body);
      break;
    case 'accepted':
      handleAcceptedWire(self, body);
      break;
    case 'rejected':
      handleRejectedWire(self, body);
      break;
    case 'sync-request':
      handleSyncRequestWire(self, body);
      break;
    case 'sync-response':
      handleSyncResponseWire(self, body);
      break;
    case 'heartbeat':
      break;
    default: {
      const _exhaustive: never = body;
      return _exhaustive;
    }
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
    self.publishSignedWire({
      kind: 'accepted',
      commandId: command.id,
      entries: sys.entries,
    } satisfies WireMessage);
  } else {
    self.finalized_command_ids.add(command.id);
    self.publishSignedWire({
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
    self.publishSignedWire({
      kind: 'accepted',
      commandId: command.id,
      entries,
    } satisfies WireMessage);
  } else {
    self.finalized_command_ids.add(command.id);
    self.publishSignedWire({
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
    if (PeerJoined.is(event)) {
      self.memberPublicKeys.set(
        event.payload.peerId,
        decodeKeyB64(event.payload.publicKey),
      );
    }
    if (PeerLeave.is(event)) {
      self.memberPublicKeys.delete(event.payload.peerId);
    }
    applyMembershipEvent(self.membership, event);
    if (PeerJoined.is(event)) {
      seedDiscoveredPeerLiveness(self, event.payload.peerId);
    }
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

  self.publishSignedWire({
    kind: 'sync-response',
    to: wire.from,
    snapshot,
    baseSeq: sinceSeq,
    syncSessionId: wire.syncSessionId,
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
  if (
    self.pendingSyncSessionId === null ||
    wire.syncSessionId !== self.pendingSyncSessionId
  ) {
    return;
  }

  const baseSeq =
    typeof wire.baseSeq === 'number' && Number.isFinite(wire.baseSeq)
      ? Math.floor(wire.baseSeq)
      : 0;
  const snap = wire.snapshot;
  crash.defined(snap, 'sync-response must include snapshot');
  crash.ok(snap.seq === baseSeq, 'snapshot.seq must equal baseSeq');

  const prefix = Array.isArray(wire.prefix) ? wire.prefix : [];
  const tail = Array.isArray(wire.entries) ? wire.entries : [];
  const full = [...prefix, ...tail].sort((a, b) => a.seq - b.seq);

  self.sync_pending = false;
  self.pendingSyncSessionId = null;
  self.rehydrate(full);

  self.synced = true;
  self.callbacks.onSync?.();
  self.notifyAuthorityElectionSynced();
}
