import { createNamespace, isPlainRecord } from '@gamezilla/lib/message'

const errNs = createNamespace('peerStore')

function validateDetail(p: unknown): p is { detail: string } {
  if (!isPlainRecord(p)) return false
  const d = p['detail']
  return typeof d === 'string'
}

function validateEmpty(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0
}

function validatePeerIdOnly(p: unknown): p is { peerId: string } {
  if (!isPlainRecord(p)) return false
  const id = p['peerId']
  return typeof id === 'string' && id.length > 0
}

function validateUnknownSystem(p: unknown): p is { commandType: string } {
  if (!isPlainRecord(p)) return false
  const t = p['commandType']
  return typeof t === 'string' && t.length > 0
}

/** Join payload was not a plain object. */
export const PeerStoreInvalidJoinShape = errNs(
  'INVALID_JOIN_SHAPE',
  validateDetail,
)
/** Join payload missing or invalid fields. */
export const PeerStoreInvalidJoinFields = errNs(
  'INVALID_JOIN_FIELDS',
  validateDetail,
)
/** Join peerId did not match command author. */
export const PeerStoreJoinPeerMismatch = errNs(
  'JOIN_PEER_MISMATCH',
  validateDetail,
)
export const PeerStoreDuplicatePeer = errNs(
  'DUPLICATE_PEER',
  validatePeerIdOnly,
)

export const PeerStoreInvalidLeaveShape = errNs(
  'INVALID_LEAVE_SHAPE',
  validateDetail,
)
export const PeerStoreInvalidLeaveFields = errNs(
  'INVALID_LEAVE_FIELDS',
  validateDetail,
)
export const PeerStoreLeaveNotSelf = errNs('LEAVE_NOT_SELF', validateDetail)
export const PeerStoreUnknownPeer = errNs('UNKNOWN_PEER', validatePeerIdOnly)

export const PeerStoreInvalidTrustShape = errNs(
  'INVALID_TRUST_SHAPE',
  validateDetail,
)
export const PeerStoreInvalidTrustFields = errNs(
  'INVALID_TRUST_FIELDS',
  validateDetail,
)
export const PeerStoreNotAuthority = errNs('NOT_AUTHORITY', validateEmpty)
export const PeerStoreUnknownSystemCommand = errNs(
  'UNKNOWN_SYSTEM_COMMAND',
  validateUnknownSystem,
)

export const PeerStoreNotSynced = errNs('NOT_SYNCED', validateEmpty)

export const PeerStoreInvalidPublicKey = errNs(
  'INVALID_PUBLIC_KEY',
  validateDetail,
)

export const PeerStoreWireAuthFailed = errNs('WIRE_AUTH_FAILED', validateDetail)

export const PeerStoreSyncSessionMismatch = errNs(
  'SYNC_SESSION_MISMATCH',
  validateDetail,
)
