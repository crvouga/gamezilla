import { createNamespace, isPlainRecord } from '@gamezilla/lib/message';

function validatePeerIdTrust(
  p: unknown
): p is { peerId: string; trust: number } {
  if (!isPlainRecord(p)) return false;
  const peerId = p['peerId'];
  const trust = p['trust'];
  if (typeof peerId !== 'string' || peerId.length === 0) return false;
  if (typeof trust !== 'number' || !Number.isFinite(trust) || trust < 0)
    return false;
  return true;
}

function validatePeerIdTrustPublicKey(
  p: unknown
): p is { peerId: string; trust: number; publicKey: string } {
  if (!isPlainRecord(p)) return false;
  const peerId = p['peerId'];
  const trust = p['trust'];
  const publicKey = p['publicKey'];
  if (typeof peerId !== 'string' || peerId.length === 0) return false;
  if (typeof trust !== 'number' || !Number.isFinite(trust) || trust < 0)
    return false;
  return typeof publicKey === 'string' && publicKey.length > 0;
}

function validatePeerIdOnly(p: unknown): p is { peerId: string } {
  if (!isPlainRecord(p)) return false;
  const peerId = p['peerId'];
  return typeof peerId === 'string' && peerId.length > 0;
}

/** Wire namespace for membership / system commands and events (`_peer/...`). */
export const peerNamespace = createNamespace('_peer');

export const PeerJoin = peerNamespace<{
  peerId: string;
  trust: number;
  /** Base64url-encoded 32-byte Ed25519 public key (must match self-certifying peerId). */
  publicKey: string;
}>('join', validatePeerIdTrustPublicKey);
export const PeerLeave = peerNamespace<{ peerId: string }>(
  'leave',
  validatePeerIdOnly
);
export const PeerTrustUpdate = peerNamespace<{
  peerId: string;
  trust: number;
}>('trust_update', validatePeerIdTrust);

export const PeerJoined = peerNamespace<{
  peerId: string;
  trust: number;
  publicKey: string;
}>('joined', validatePeerIdTrustPublicKey);
export const PeerLeft = peerNamespace<{ peerId: string }>(
  'left',
  validatePeerIdOnly
);
export const PeerTrustUpdated = peerNamespace<{
  peerId: string;
  trust: number;
}>('trust_updated', validatePeerIdTrust);

/** Prefix for system events in the replicated log (e.g. `_peer/joined`). */
export const PEER_MESSAGE_PREFIX = `${peerNamespace.prefix}/`;
