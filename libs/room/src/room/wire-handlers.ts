import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../persistence/log-entry';
import type { RoomError } from '../events/message-types';
import { decodeKeyB64 } from './security/peer-crypto';
import { PeerJoined, PeerLeave, peerNamespace } from '../events/system-messages';
import { isSystemEvent } from '../events/utils';
import {
  checkAuthorityChange,
  seedDiscoveredPeerLiveness,
  updateLastSeenVerified,
} from './authority-monitor';
import { applyMembershipEvent, materializeAtSeq } from './membership';
import type { Room } from './room';
import type { Command, RoomEffect } from './types';
import type { WireMessage } from './wire-protocol';

const crash: Assert = Assert.crash();

export function handleWireMessage(self: Room, payload: unknown): void {
  if (self.is_destroyed) return;
  const verified = self.verifyInboundWire(payload);
  if (!verified) return;

  updateLastSeenVerified(self, verified.signerPeerId);
  checkAuthorityChange(self);

  dispatchVerifiedBody(self, verified.body);
}

/** Single path: apply committed entries then broadcast `accepted` (authority). */
export function authorityAcceptCommit(
  self: Room,
  commandId: string,
  entries: LogEntry[],
  effects?: RoomEffect[],
): void {
  handleCommitEntries(self, commandId, entries, effects);
  self.publishSignedWire({
    kind: 'accepted',
    commandId,
    entries,
  } satisfies WireMessage);
}

export function authorityRejectProposal(
  self: Room,
  commandId: string,
  error: RoomError,
): void {
  self.finalized_command_ids.add(commandId);
  self.appendPersistenceEntry({ kind: 'rejected', commandId });
  self.publishSignedWire({
    kind: 'rejected',
    commandId,
    error,
  } satisfies WireMessage);
}

function dispatchVerifiedBody(self: Room, body: WireMessage): void {
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
  self: Room,
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

function handleProposeSystem(self: Room, command: Command): void {
  const sys = self.evaluateSystemCommand(command);
  if (sys.ok) {
    authorityAcceptCommit(self, command.id, sys.entries);
  } else {
    authorityRejectProposal(self, command.id, sys.error);
  }
}

function handleProposeDomain(self: Room, command: Command): void {
  const evaluated = self.authorityEvaluateDomain(command);
  if (evaluated.ok) {
    authorityAcceptCommit(
      self,
      command.id,
      evaluated.entries,
      evaluated.effects,
    );
  } else {
    authorityRejectProposal(self, command.id, evaluated.error);
  }
}

export function handleAcceptedWire(
  self: Room,
  wire: WireMessage & { kind: 'accepted' },
): void {
  const { commandId, entries } = wire;
  crash.array(entries, 'accepted must include entries array');
  handleCommitEntries(self, commandId, entries);
}

export function handleRejectedWire(
  self: Room,
  wire: WireMessage & { kind: 'rejected' },
): void {
  const { commandId } = wire;
  if (self.finalized_command_ids.has(commandId)) return;
  self.finalized_command_ids.add(commandId);
  self.appendPersistenceEntry({ kind: 'rejected', commandId });

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

function applyCommitEntry(self: Room, entry: LogEntry): void {
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
  self: Room,
  commandId: string,
  entries: LogEntry[],
  effects?: RoomEffect[],
): void {
  if (self.finalized_command_ids.has(commandId)) return;
  self.finalized_command_ids.add(commandId);
  self.appendPersistenceEntry({ kind: 'committed', commandId, entries });

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
  self: Room,
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
  self: Room,
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
}
