import { timingSafeEqual } from 'node:crypto';
import { PeerJoin, peerNamespace } from '../protocol/system-messages';
import {
  decodeKeyB64,
  fingerprintFromPublicKey,
  peerIdFromPublicKey,
} from './security/peer-crypto';
import type { PeerStoreSecurityConfig } from './peer-store-types';
import type { VerifiedWireEnvelope } from './security/wire-envelope';
import type { WireMessage } from './wire-protocol';

export function keysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

type MemberKeys = Map<string, Uint8Array>;

function signerDerivedMatches(signerPublicKey: Uint8Array, signerPeerId: string): boolean {
  let derived: string;
  try {
    derived = peerIdFromPublicKey(signerPublicKey);
  } catch {
    return false;
  }
  return derived === signerPeerId;
}

export function isSignerKeyAllowedForWire(
  memberPublicKeys: MemberKeys,
  signerPeerId: string,
  signerPublicKey: Uint8Array,
  body: WireMessage,
): boolean {
  if (!signerDerivedMatches(signerPublicKey, signerPeerId)) return false;

  const known = memberPublicKeys.get(signerPeerId);
  if (known !== undefined) {
    return keysEqual(known, signerPublicKey);
  }

  if (
    body.kind === 'propose' &&
    peerNamespace.owns(body.command.message) &&
    PeerJoin.is(body.command.message)
  ) {
    const pay = body.command.message.payload;
    if (pay.peerId !== signerPeerId) return false;
    try {
      const joinPub = decodeKeyB64(pay.publicKey);
      return keysEqual(joinPub, signerPublicKey);
    } catch {
      return false;
    }
  }

  if (body.kind === 'heartbeat' || body.kind === 'sync-request') {
    return true;
  }

  return false;
}

export type InboundWireAuthContext = {
  security: PeerStoreSecurityConfig;
  memberPublicKeys: MemberKeys;
  current_authority: string;
  inboundWireCounters: Map<string, number>;
  onWireAuthFailure?: (reason: string) => void;
};

function checkFingerprintOrFail(
  ctx: InboundWireAuthContext,
  signerPeerId: string,
  signerPublicKey: Uint8Array,
): boolean {
  const expectedFp = ctx.security.peerFingerprints?.[signerPeerId];
  if (expectedFp === undefined) return true;
  const got = fingerprintFromPublicKey(signerPublicKey);
  if (got === expectedFp) return true;
  ctx.onWireAuthFailure?.('peer_fingerprint_mismatch');
  return false;
}

function checkAuthorityKinds(
  ctx: InboundWireAuthContext,
  signerPeerId: string,
  body: WireMessage,
): boolean {
  const needsAuthority =
    body.kind === 'accepted' ||
    body.kind === 'rejected' ||
    body.kind === 'sync-response';
  if (!needsAuthority) return true;
  if (signerPeerId === ctx.current_authority) return true;
  ctx.onWireAuthFailure?.('signer_not_current_authority');
  return false;
}

function checkSignerBodyBinding(
  ctx: InboundWireAuthContext,
  signerPeerId: string,
  body: WireMessage,
): boolean {
  if (body.kind === 'propose' && body.command.peerId !== signerPeerId) {
    ctx.onWireAuthFailure?.('propose_peer_mismatch');
    return false;
  }
  if (body.kind === 'heartbeat' && body.from !== signerPeerId) {
    ctx.onWireAuthFailure?.('heartbeat_from_mismatch');
    return false;
  }
  if (body.kind === 'sync-request' && body.from !== signerPeerId) {
    ctx.onWireAuthFailure?.('sync_request_from_mismatch');
    return false;
  }
  return true;
}

export function finalizeInboundWireVerification(
  ctx: InboundWireAuthContext,
  vr: VerifiedWireEnvelope,
): VerifiedWireEnvelope | null {
  const { signerPeerId, signerPublicKey, counter, body } = vr;
  if (!checkFingerprintOrFail(ctx, signerPeerId, signerPublicKey)) return null;
  if (!isSignerKeyAllowedForWire(ctx.memberPublicKeys, signerPeerId, signerPublicKey, body)) {
    ctx.onWireAuthFailure?.('unknown_member_key');
    return null;
  }
  if (!checkAuthorityKinds(ctx, signerPeerId, body)) return null;
  if (!checkSignerBodyBinding(ctx, signerPeerId, body)) return null;
  ctx.inboundWireCounters.set(signerPeerId, counter);
  return vr;
}
