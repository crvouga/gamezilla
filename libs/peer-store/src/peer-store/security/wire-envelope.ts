import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../../peer-store-persistence/log-entry';
import type { StoreError } from '../../protocol/message-types';
import type { Command } from '../peer-store-types';
import {
  parseAcceptedWire,
  parseProposeWire,
  parseRejectedWire,
  parseSyncRequestWire,
  parseSyncResponseWire,
} from '../wire-parsers';
import type { WireMessage } from '../wire-protocol';
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
} from './peer-crypto';
import { isPlainRecord } from './plain-record';
import { stableStringify } from './stable-stringify';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export const PEER_STORE_WIRE_SCHEME = 'peer-store-wire-v1' as const;

export type SignedWireEnvelopeV1 = {
  scheme: typeof PEER_STORE_WIRE_SCHEME;
  v: 1;
  topic: string;
  signerPeerId: string;
  signerPubKeyB64: string;
  counter: number;
  roomProof: string;
  bodyDigest: string;
  body: WireMessage;
  signatureB64: string;
};

/** Canonical wire body shape used for `bodyDigest` (must match on sign and verify). */
export function wireMessageToSignable(msg: WireMessage): unknown {
  switch (msg.kind) {
    case 'propose':
      return {
        kind: 'propose',
        command: commandToSignable(msg.command),
      };
    case 'accepted':
      return {
        kind: 'accepted',
        commandId: msg.commandId,
        entries: msg.entries.map(logEntryToSignable),
      };
    case 'rejected':
      return {
        kind: 'rejected',
        commandId: msg.commandId,
        error: storeErrorToSignable(msg.error),
      };
    case 'heartbeat':
      return {
        kind: 'heartbeat',
        from: msg.from,
        latestSeq: msg.latestSeq,
      };
    case 'sync-request':
      return {
        kind: 'sync-request',
        from: msg.from,
        sinceSeq: msg.sinceSeq,
        syncSessionId: msg.syncSessionId,
      };
    case 'sync-response':
      return {
        kind: 'sync-response',
        to: msg.to,
        baseSeq: msg.baseSeq,
        syncSessionId: msg.syncSessionId,
        snapshot: msg.snapshot,
        prefix: msg.prefix.map(logEntryToSignable),
        entries: msg.entries.map(logEntryToSignable),
      };
    default: {
      const _exhaustive: never = msg;
      return _exhaustive;
    }
  }
}

function commandToSignable(cmd: Command): unknown {
  return {
    id: cmd.id,
    seq: cmd.seq,
    peerId: cmd.peerId,
    message: { type: cmd.message.type, payload: cmd.message.payload },
  };
}

function logEntryToSignable(e: LogEntry): unknown {
  return {
    seq: e.seq,
    event: { type: e.event.type, payload: e.event.payload },
  };
}

function storeErrorToSignable(err: StoreError): unknown {
  return { type: err.type, payload: err.payload };
}

export function parseWireBodyToMessage(
  body: Record<string, unknown>
): WireMessage {
  const kind = body['kind'];
  crash.string(kind, 'wire body.kind must be string');
  switch (kind) {
    case 'propose':
      return parseProposeWire(body);
    case 'accepted':
      return parseAcceptedWire(body);
    case 'rejected':
      return parseRejectedWire(body);
    case 'sync-request':
      return parseSyncRequestWire(body);
    case 'sync-response':
      return parseSyncResponseWire(body);
    default:
      validation.fail(`unsupported wire body kind: ${kind}`);
  }
}

export type SignWireEnvelopeInput = {
  topic: string;
  roomSecret: string;
  body: WireMessage;
  signerPeerId: string;
  secretSeed: Uint8Array;
  counter: number;
};

export function signWireEnvelope(
  input: SignWireEnvelopeInput
): SignedWireEnvelopeV1 {
  const publicKey = publicKeyFromSecretSeed(input.secretSeed);
  const derived = peerIdFromPublicKey(publicKey);
  crash.ok(
    derived === input.signerPeerId,
    'signerPeerId must equal peerId derived from secret key',
    { derived, signerPeerId: input.signerPeerId }
  );
  const signerPubKeyB64 = encodeKeyB64(publicKey);
  const roomProof = computeRoomProof(input.roomSecret, input.topic);
  const bodyDigest = sha256Hex(
    stableStringify(wireMessageToSignable(input.body))
  );
  const signInput = stableStringify({
    scheme: PEER_STORE_WIRE_SCHEME,
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
    scheme: PEER_STORE_WIRE_SCHEME,
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

export type VerifiedWireEnvelope = {
  signerPeerId: string;
  signerPublicKey: Uint8Array;
  counter: number;
  body: WireMessage;
};

export type VerifyWireEnvelopeInput = {
  topic: string;
  roomSecret: string;
  raw: unknown;
  lastCounters: Map<string, number>;
};

type WireVerifyFail = { ok: false; reason: string };

function wireEnvelopeAsRecord(raw: unknown): Record<string, unknown> | null {
  return isPlainRecord(raw) ? raw : null;
}

function wireHeaderChecks(
  rec: Record<string, unknown>,
  expectedTopic: string,
): WireVerifyFail | void {
  if (rec['scheme'] !== PEER_STORE_WIRE_SCHEME) {
    return { ok: false, reason: 'bad_scheme' };
  }
  if (rec['v'] !== 1) return { ok: false, reason: 'bad_version' };
  if (rec['topic'] !== expectedTopic) return { ok: false, reason: 'topic_mismatch' };
}

function wireSignerMaterial(
  rec: Record<string, unknown>,
):
  | WireVerifyFail
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
  if (derived !== signerPeerId) {
    return { ok: false, reason: 'peer_id_pubkey_mismatch' };
  }
  return { ok: true, signerPeerId, signerPubKeyB64, publicKey };
}

function wireRoomProof(
  rec: Record<string, unknown>,
  roomSecret: string,
  topic: string,
): WireVerifyFail | { ok: true; roomProof: string } {
  const roomProof = rec['roomProof'];
  if (typeof roomProof !== 'string') return { ok: false, reason: 'bad_room_proof' };
  const expectedProof = computeRoomProof(roomSecret, topic);
  if (roomProof !== expectedProof) return { ok: false, reason: 'room_proof_mismatch' };
  return { ok: true, roomProof };
}

function wireCounter(
  rec: Record<string, unknown>,
  signerPeerId: string,
  lastCounters: Map<string, number>,
): WireVerifyFail | { ok: true; counter: number } {
  const counterRaw = rec['counter'];
  if (
    typeof counterRaw !== 'number' ||
    !Number.isFinite(counterRaw) ||
    counterRaw < 0
  ) {
    return { ok: false, reason: 'bad_counter' };
  }
  const counter = Math.floor(counterRaw);
  const prev = lastCounters.get(signerPeerId) ?? 0;
  if (counter <= prev) return { ok: false, reason: 'replay_or_stale_counter' };
  return { ok: true, counter };
}

function wireParsedBody(
  rec: Record<string, unknown>,
): WireVerifyFail | { ok: true; body: WireMessage; bodyDigest: string } {
  const bodyDigest = rec['bodyDigest'];
  if (typeof bodyDigest !== 'string') {
    return { ok: false, reason: 'bad_body_digest_field' };
  }
  const bodyUnknown = rec['body'];
  if (!isPlainRecord(bodyUnknown)) return { ok: false, reason: 'bad_body' };
  let body: WireMessage;
  try {
    body = parseWireBodyToMessage(bodyUnknown);
  } catch {
    return { ok: false, reason: 'body_parse' };
  }
  let recomputed: string;
  try {
    recomputed = sha256Hex(stableStringify(wireMessageToSignable(body)));
  } catch {
    return { ok: false, reason: 'body_digest_compute' };
  }
  if (recomputed !== bodyDigest) {
    return { ok: false, reason: 'body_digest_mismatch' };
  }
  return { ok: true, body, bodyDigest };
}

type WireSigInput = {
  rec: Record<string, unknown>;
  topic: string;
  signerPeerId: string;
  signerPubKeyB64: string;
  counter: number;
  roomProof: string;
  bodyDigest: string;
  publicKey: Uint8Array;
};

function wireSignatureOk(ctx: WireSigInput): WireVerifyFail | void {
  const signatureB64 = ctx.rec['signatureB64'];
  if (typeof signatureB64 !== 'string') {
    return { ok: false, reason: 'bad_signature_field' };
  }
  let sig: Uint8Array;
  try {
    sig = Buffer.from(signatureB64, 'base64url');
  } catch {
    return { ok: false, reason: 'sig_decode' };
  }
  const signInput = stableStringify({
    scheme: PEER_STORE_WIRE_SCHEME,
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

type WireAuthzBodyOk = {
  ok: true;
  signerPeerId: string;
  signerPubKeyB64: string;
  publicKey: Uint8Array;
  roomProof: string;
  counter: number;
  body: WireMessage;
  bodyDigest: string;
};

function wireEnvelopeAuthzAndBody(
  input: VerifyWireEnvelopeInput,
  rec: Record<string, unknown>,
): WireVerifyFail | WireAuthzBodyOk {
  const h = wireHeaderChecks(rec, input.topic);
  if (h) return h;

  const signer = wireSignerMaterial(rec);
  if (!signer.ok) return signer;

  const room = wireRoomProof(rec, input.roomSecret, input.topic);
  if (!room.ok) return room;

  const ctr = wireCounter(rec, signer.signerPeerId, input.lastCounters);
  if (!ctr.ok) return ctr;

  const parsed = wireParsedBody(rec);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    signerPeerId: signer.signerPeerId,
    signerPubKeyB64: signer.signerPubKeyB64,
    publicKey: signer.publicKey,
    roomProof: room.roomProof,
    counter: ctr.counter,
    body: parsed.body,
    bodyDigest: parsed.bodyDigest,
  };
}

export function verifyWireEnvelope(
  input: VerifyWireEnvelopeInput
): VerifiedWireEnvelope | { ok: false; reason: string } {
  const rec = wireEnvelopeAsRecord(input.raw);
  if (rec === null) return { ok: false, reason: 'envelope_not_object' };

  const mid = wireEnvelopeAuthzAndBody(input, rec);
  if (!mid.ok) return mid;

  const sig = wireSignatureOk({
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

  return {
    signerPeerId: mid.signerPeerId,
    signerPublicKey: mid.publicKey,
    counter: mid.counter,
    body: mid.body,
  };
}
