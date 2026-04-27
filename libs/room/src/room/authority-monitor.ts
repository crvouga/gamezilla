import type { WireMessage } from './wire-protocol';
import type { Room } from './room';

export type LivenessSink = {
  peerId: string;
  last_seen: Map<string, number>;
};

export function broadcastHeartbeat(self: Room): void {
  if (self.is_destroyed) return;
  self.publishSignedWire({
    kind: 'heartbeat',
    from: self.peerId,
    latestSeq: self.latestLogSeq,
  } satisfies WireMessage);
}

export function checkAuthorityChange(
  self: Room,
  onLivenessAuthorityChange?: (prev: string, next: string) => void,
): void {
  const newAuthority = deriveAuthority(self);
  if (newAuthority !== self.current_authority) {
    const prev = self.current_authority;
    self.current_authority = newAuthority;
    self.callbacks.onAuthorityChange?.(newAuthority, prev);
    onLivenessAuthorityChange?.(prev, newAuthority);
  }
}

function deriveAuthority(self: Room): string {
  const alive = self.authority_order.filter(
    (id) => id === self.peerId || isAlive(self, id),
  );
  return alive[0] ?? self.peerId;
}

function isAlive(self: Room, peerId: string): boolean {
  if (peerId === self.peerId) return true;
  const lastSeen = self.last_seen.get(peerId);
  if (lastSeen === undefined) return false;
  return Date.now() - lastSeen < self.heartbeatTimeoutMs;
}

/** Call when membership learns a remote peer so failover can run before first heartbeat. */
export function seedDiscoveredPeerLiveness(self: LivenessSink, peerId: string): void {
  if (peerId === self.peerId) return;
  self.last_seen.set(peerId, Date.now());
}

export function seedAllRemotePeersLiveness(self: LivenessSink & { membership: Map<string, number> }): void {
  for (const id of self.membership.keys()) {
    seedDiscoveredPeerLiveness(self, id);
  }
}

/** After cryptographic verification, record liveness for the authenticated signer. */
export function updateLastSeenVerified(
  self: Room,
  signerPeerId: string,
): void {
  if (signerPeerId !== self.peerId) {
    self.last_seen.set(signerPeerId, Date.now());
  }
}
