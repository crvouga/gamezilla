import { createNamespace, isPlainRecord } from '@gamezilla/lib/message';

const errNs = createNamespace('room');

function validateDetail(p: unknown): p is { detail: string } {
  if (!isPlainRecord(p)) return false;
  const d = p['detail'];
  return typeof d === 'string';
}

function validateEmpty(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

function validatePeerIdOnly(p: unknown): p is { peerId: string } {
  if (!isPlainRecord(p)) return false;
  const id = p['peerId'];
  return typeof id === 'string' && id.length > 0;
}

function validateUnknownSystem(p: unknown): p is { commandType: string } {
  if (!isPlainRecord(p)) return false;
  const t = p['commandType'];
  return typeof t === 'string' && t.length > 0;
}

/** Join payload invalid (shape or fields); see `detail`. */
export const RoomJoinInvalid = errNs('JOIN_INVALID', validateDetail);

/** Leave payload invalid (shape or fields); see `detail`. */
export const RoomLeaveInvalid = errNs('LEAVE_INVALID', validateDetail);

/** Trust update payload invalid (shape or fields); see `detail`. */
export const RoomTrustInvalid = errNs('TRUST_INVALID', validateDetail);

/** Join peerId did not match command author. */
export const RoomJoinPeerMismatch = errNs('JOIN_PEER_MISMATCH', validateDetail);

export const RoomDuplicatePeer = errNs('DUPLICATE_PEER', validatePeerIdOnly);

export const RoomLeaveNotSelf = errNs('LEAVE_NOT_SELF', validateDetail);
export const RoomUnknownPeer = errNs('UNKNOWN_PEER', validatePeerIdOnly);

export const RoomNotAuthority = errNs('NOT_AUTHORITY', validateEmpty);
export const RoomUnknownSystemCommand = errNs(
  'UNKNOWN_SYSTEM_COMMAND',
  validateUnknownSystem
);

export const RoomNotSynced = errNs('NOT_SYNCED', validateEmpty);

export const RoomInvalidPublicKey = errNs('INVALID_PUBLIC_KEY', validateDetail);

export const RoomWireAuthFailed = errNs('WIRE_AUTH_FAILED', validateDetail);

export const RoomSyncSessionMismatch = errNs(
  'SYNC_SESSION_MISMATCH',
  validateDetail
);
