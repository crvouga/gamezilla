import { Assert } from '@gamezilla/lib/assert';
import {
  computeRoomProof,
  decodeKeyB64,
  encodeKeyB64,
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
  sha256Hex,
  signDetached,
  utf8,
  verifyDetached,
} from '../peer-store/security/peer-crypto';
import { isPlainRecord } from '../peer-store/security/plain-record';
import { stableStringify } from '../peer-store/security/stable-stringify';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export const TRUST_BALLOT_SCHEME = 'trust-election-ballot-v1' as const;

export function trustElectionTransportTopic(electionId: string): string {
  crash.nonEmptyString(electionId, 'electionId must be non-empty');
  return `trust-election:${electionId}`;
}

export type TrustBallotBody = {
  kind: 'trust-vote-v2';
  electionId: string;
  voterPeerId: string;
  trustedPeer: string;
};

function bodyToSignable(b: TrustBallotBody): unknown {
  return {
    kind: b.kind,
    electionId: b.electionId,
    voterPeerId: b.voterPeerId,
    trustedPeer: b.trustedPeer,
  };
}

export function parseTrustBallotBody(
  raw: Record<string, unknown>,
): TrustBallotBody | null {
  const kind = raw['kind'];
  if (kind !== 'trust-vote-v2') return null;
  const electionId = raw['electionId'];
  const voterPeerId = raw['voterPeerId'];
  const trustedPeer = raw['trustedPeer'];
  if (typeof electionId !== 'string' || !electionId) return null;
  if (typeof voterPeerId !== 'string' || !voterPeerId) return null;
  if (typeof trustedPeer !== 'string' || !trustedPeer) return null;
  return {
    kind: 'trust-vote-v2',
    electionId,
    voterPeerId,
    trustedPeer,
  };
}

export type SignTrustBallotInput = {
  electionId: string;
  topic: string;
  roomSecret: string;
  body: TrustBallotBody;
  signerPeerId: string;
  secretSeed: Uint8Array;
  counter: number;
};

export type SignedTrustBallotEnvelopeV1 = {
  scheme: typeof TRUST_BALLOT_SCHEME;
  v: 1;
  topic: string;
  signerPeerId: string;
  signerPubKeyB64: string;
  counter: number;
  roomProof: string;
  bodyDigest: string;
  body: TrustBallotBody;
  signatureB64: string;
};

export function signTrustBallotEnvelope(
  input: SignTrustBallotInput,
): SignedTrustBallotEnvelopeV1 {
  const publicKey = publicKeyFromSecretSeed(input.secretSeed);
  const derived = peerIdFromPublicKey(publicKey);
  crash.ok(derived === input.signerPeerId, 'signerPeerId must match secret key');
  const signerPubKeyB64 = encodeKeyB64(publicKey);
  const roomProof = computeRoomProof(input.roomSecret, input.topic);
  const bodyDigest = sha256Hex(stableStringify(bodyToSignable(input.body)));
  const signInput = stableStringify({
    scheme: TRUST_BALLOT_SCHEME,
    v: 1,
    topic: input.topic,
    signerPeerId: input.signerPeerId,
    signerPubKeyB64,
    counter: input.counter,
    roomProof,
    bodyDigest,
  });
  const sig = signDetached(utf8(signInput), input.secretSeed);
  return {
    scheme: TRUST_BALLOT_SCHEME,
    v: 1,
    topic: input.topic,
    signerPeerId: input.signerPeerId,
    signerPubKeyB64,
    counter: input.counter,
    roomProof,
    bodyDigest,
    body: input.body,
    signatureB64: Buffer.from(sig).toString('base64url'),
  };
}

export type VerifiedTrustBallot = {
  signerPeerId: string;
  signerPublicKey: Uint8Array;
  counter: number;
  body: TrustBallotBody;
};

type BallotVerifyFail = { ok: false; reason: string };

function trustBallotAsRecord(raw: unknown): Record<string, unknown> | null {
  return isPlainRecord(raw) ? raw : null;
}

function trustBallotHeader(
  rec: Record<string, unknown>,
  expectedTopic: string,
): BallotVerifyFail | void {
  if (rec['scheme'] !== TRUST_BALLOT_SCHEME) return { ok: false, reason: 'bad_scheme' };
  if (rec['v'] !== 1) return { ok: false, reason: 'bad_version' };
  if (rec['topic'] !== expectedTopic) return { ok: false, reason: 'topic_mismatch' };
}

function trustBallotSigner(
  rec: Record<string, unknown>,
):
  | BallotVerifyFail
  | { ok: true; signerPeerId: string; signerPubKeyB64: string; publicKey: Uint8Array } {
  const signerPeerId = rec['signerPeerId'];
  if (typeof signerPeerId !== 'string' || !signerPeerId) {
    return { ok: false, reason: 'bad_signer_peer_id' };
  }
  const signerPubKeyB64 = rec['signerPubKeyB64'];
  if (typeof signerPubKeyB64 !== 'string') {
    return { ok: false, reason: 'bad_signer_pub_key' };
  }
  let publicKey: Uint8Array;
  try {
    publicKey = decodeKeyB64(signerPubKeyB64);
  } catch {
    return { ok: false, reason: 'pub_key_decode' };
  }
  let derived: string;
  try {
    derived = peerIdFromPublicKey(publicKey);
  } catch {
    return { ok: false, reason: 'peer_id_derive' };
  }
  if (derived !== signerPeerId) return { ok: false, reason: 'peer_id_pubkey_mismatch' };
  return { ok: true, signerPeerId, signerPubKeyB64, publicKey };
}

function trustBallotRoom(
  rec: Record<string, unknown>,
  roomSecret: string,
  topic: string,
): BallotVerifyFail | { ok: true; roomProof: string } {
  const roomProof = rec['roomProof'];
  if (typeof roomProof !== 'string') return { ok: false, reason: 'bad_room_proof' };
  const expectedProof = computeRoomProof(roomSecret, topic);
  if (roomProof !== expectedProof) return { ok: false, reason: 'room_proof_mismatch' };
  return { ok: true, roomProof };
}

function trustBallotCounter(
  rec: Record<string, unknown>,
  signerPeerId: string,
  lastCounters: Map<string, number>,
): BallotVerifyFail | { ok: true; counter: number } {
  const counterRaw = rec['counter'];
  if (typeof counterRaw !== 'number' || !Number.isFinite(counterRaw) || counterRaw < 0) {
    return { ok: false, reason: 'bad_counter' };
  }
  const counter = Math.floor(counterRaw);
  const prev = lastCounters.get(signerPeerId) ?? 0;
  if (counter <= prev) return { ok: false, reason: 'replay_or_stale_counter' };
  return { ok: true, counter };
}

function trustBallotBodyDigest(
  rec: Record<string, unknown>,
): BallotVerifyFail | { ok: true; bodyDigest: string; body: TrustBallotBody } {
  const bodyDigest = rec['bodyDigest'];
  if (typeof bodyDigest !== 'string') return { ok: false, reason: 'bad_body_digest_field' };
  const bodyUnknown = rec['body'];
  if (!isPlainRecord(bodyUnknown)) return { ok: false, reason: 'bad_body' };
  const body = parseTrustBallotBody(bodyUnknown);
  if (body === null) return { ok: false, reason: 'body_parse' };
  let recomputed: string;
  try {
    recomputed = sha256Hex(stableStringify(bodyToSignable(body)));
  } catch {
    return { ok: false, reason: 'body_digest_compute' };
  }
  if (recomputed !== bodyDigest) return { ok: false, reason: 'body_digest_mismatch' };
  return { ok: true, bodyDigest, body };
}

type TrustBallotSigCtx = {
  rec: Record<string, unknown>;
  topic: string;
  signerPeerId: string;
  signerPubKeyB64: string;
  counter: number;
  roomProof: string;
  bodyDigest: string;
  publicKey: Uint8Array;
};

function trustBallotSignature(ctx: TrustBallotSigCtx): BallotVerifyFail | void {
  const signatureB64 = ctx.rec['signatureB64'];
  if (typeof signatureB64 !== 'string') return { ok: false, reason: 'bad_signature_field' };
  let sig: Uint8Array;
  try {
    sig = Buffer.from(signatureB64, 'base64url');
  } catch {
    return { ok: false, reason: 'sig_decode' };
  }
  const signInput = stableStringify({
    scheme: TRUST_BALLOT_SCHEME,
    v: 1,
    topic: ctx.topic,
    signerPeerId: ctx.signerPeerId,
    signerPubKeyB64: ctx.signerPubKeyB64,
    counter: ctx.counter,
    roomProof: ctx.roomProof,
    bodyDigest: ctx.bodyDigest,
  });
  if (!verifyDetached(utf8(signInput), new Uint8Array(sig), ctx.publicKey)) {
    return { ok: false, reason: 'signature_invalid' };
  }
}

type TrustBallotMidOk = {
  ok: true;
  signerPeerId: string;
  signerPubKeyB64: string;
  publicKey: Uint8Array;
  roomProof: string;
  counter: number;
  body: TrustBallotBody;
  bodyDigest: string;
};

function trustBallotAuthzAndBody(
  input: { topic: string; roomSecret: string; lastCounters: Map<string, number> },
  rec: Record<string, unknown>,
): BallotVerifyFail | TrustBallotMidOk {
  const head = trustBallotHeader(rec, input.topic);
  if (head) return head;

  const signer = trustBallotSigner(rec);
  if (!signer.ok) return signer;

  const room = trustBallotRoom(rec, input.roomSecret, input.topic);
  if (!room.ok) return room;

  const ctr = trustBallotCounter(rec, signer.signerPeerId, input.lastCounters);
  if (!ctr.ok) return ctr;

  const bd = trustBallotBodyDigest(rec);
  if (!bd.ok) return bd;

  return {
    ok: true,
    signerPeerId: signer.signerPeerId,
    signerPubKeyB64: signer.signerPubKeyB64,
    publicKey: signer.publicKey,
    roomProof: room.roomProof,
    counter: ctr.counter,
    body: bd.body,
    bodyDigest: bd.bodyDigest,
  };
}

export function verifyTrustBallotEnvelope(input: {
  topic: string;
  roomSecret: string;
  raw: unknown;
  lastCounters: Map<string, number>;
}): VerifiedTrustBallot | { ok: false; reason: string } {
  const rec = trustBallotAsRecord(input.raw);
  if (rec === null) return { ok: false, reason: 'envelope_not_object' };

  const mid = trustBallotAuthzAndBody(input, rec);
  if (!mid.ok) return mid;

  const sig = trustBallotSignature({
    rec,
    topic: input.topic,
    signerPeerId: mid.signerPeerId,
    signerPubKeyB64: mid.signerPubKeyB64,
    counter: mid.counter,
    roomProof: mid.roomProof,
    bodyDigest: mid.bodyDigest,
    publicKey: mid.publicKey,
  });
  if (sig) return sig;

  validation.nonEmptyString(mid.body.electionId, 'ballot.electionId');
  if (mid.body.voterPeerId !== mid.signerPeerId) {
    return { ok: false, reason: 'voter_mismatch' };
  }
  return {
    signerPeerId: mid.signerPeerId,
    signerPublicKey: mid.publicKey,
    counter: mid.counter,
    body: mid.body,
  };
}
