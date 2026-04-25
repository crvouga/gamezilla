import { Assert } from '@gamezilla/lib/assert';
import type { PeerStore } from './peer-store';
import type { WireMessage } from './wire-protocol';

const crash: Assert = Assert.crash();

export function broadcastHeartbeat(self: PeerStore): void {
  if (self.is_destroyed) return;
  self.transport.publish(self.topic, {
    kind: 'heartbeat',
    from: self.peerId,
    latestSeq: self.latestLogSeq,
  } satisfies WireMessage);
}

export function checkAuthorityChange(self: PeerStore): void {
  const newAuthority = deriveAuthority(self);
  if (newAuthority !== self.current_authority) {
    const prev = self.current_authority;
    self.current_authority = newAuthority;
    self.callbacks.onAuthorityChange?.(newAuthority, prev);
  }
}

function deriveAuthority(self: PeerStore): string {
  const alive = self.authority_order.filter(
    (id) => id === self.peerId || isAlive(self, id),
  );
  return alive[0] ?? self.peerId;
}

function isAlive(self: PeerStore, peerId: string): boolean {
  if (peerId === self.peerId) return true;
  const lastSeen = self.last_seen.get(peerId);
  if (lastSeen === undefined) return true;
  return Date.now() - lastSeen < self.heartbeatTimeoutMs;
}

export function updateLastSeenFromRecord(
  self: PeerStore,
  msg: Record<string, unknown>,
): void {
  const from = msg['from'];
  if (typeof from === 'string' && from !== self.peerId) {
    self.last_seen.set(from, Date.now());
  }
  const commandUnknown = msg['command'];
  if (
    commandUnknown !== null &&
    typeof commandUnknown === 'object' &&
    !Array.isArray(commandUnknown)
  ) {
    crash.record(commandUnknown, 'propose command must be a plain object');
    const cmdPeerId = commandUnknown['peerId'];
    if (typeof cmdPeerId === 'string' && cmdPeerId !== self.peerId) {
      self.last_seen.set(cmdPeerId, Date.now());
    }
  }
}
