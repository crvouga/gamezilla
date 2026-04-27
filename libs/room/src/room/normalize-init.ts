import { Assert } from '@gamezilla/lib/assert';
import {
  validateRoomInitConfig,
  type RoomCoreInitConfig,
} from './validate-init-config';
import type {
  NormalizedRoomInit,
  PeerBootstrap,
  RoomConfig,
  RoomConfigCore,
} from './types';
import {
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
} from './security/peer-crypto';

const crash: Assert = Assert.crash();

function peerIdFromSecretSeed(secretSeed: Uint8Array): string {
  const pub = publicKeyFromSecretSeed(secretSeed);
  return peerIdFromPublicKey(pub);
}

function validateRoomHostConfig(room: RoomConfigCore): void {
  crash.ok(room.role.type === 'host', 'expected host role');
  const { initialMembership, initialMemberPublicKeys } = room.role;
  const derivedPeerId = peerIdFromSecretSeed(room.secretSeed);
  crash.ok(
    derivedPeerId in initialMembership,
    'host role: initialMembership must include peer derived from secretSeed',
    { derivedPeerId },
  );
  const ids = Object.keys(initialMembership);
  crash.ok(
    ids.length >= 2,
    'host initialMembership must list at least 2 peers',
  );
  for (const id of ids) {
    crash.ok(
      id in initialMemberPublicKeys,
      'host initialMemberPublicKeys must cover initialMembership',
      { id },
    );
  }
}

function validateRoomJoinConfig(room: RoomConfigCore): void {
  crash.ok(room.role.type === 'join', 'expected join role');
  const { initialMembership, initialMemberPublicKeys } = room.role.roomSnapshot;
  const ids = Object.keys(initialMembership);
  crash.ok(
    ids.length >= 2,
    'join roomSnapshot.initialMembership must list at least 2 peers',
  );
  for (const id of ids) {
    crash.ok(
      id in initialMemberPublicKeys,
      'join roomSnapshot.initialMemberPublicKeys must cover initialMembership',
      { id },
    );
  }
}

function validateRoomConfig(room: RoomConfigCore): void {
  crash.nonEmptyString(room.topic, 'room.topic must be non-empty');
  crash.nonEmptyString(room.roomSecret, 'room.roomSecret must be non-empty');
  crash.defined(room.persistence, 'room.persistence is required');
  crash.ok(
    room.secretSeed instanceof Uint8Array && room.secretSeed.length === 32,
    'room.secretSeed must be Uint8Array of length 32',
  );
  if (room.role.type === 'host') {
    validateRoomHostConfig(room);
  } else {
    validateRoomJoinConfig(room);
  }
}

function roomToBootstrap(room: RoomConfigCore): PeerBootstrap {
  if (room.role.type === 'host') {
    return {
      kind: 'genesis',
      initialMembership: { ...room.role.initialMembership },
      initialMemberPublicKeys: { ...room.role.initialMemberPublicKeys },
    };
  }
  return {
    kind: 'join',
    initialMembership: { ...room.role.roomSnapshot.initialMembership },
    initialMemberPublicKeys: {
      ...room.role.roomSnapshot.initialMemberPublicKeys,
    },
  };
}

function pickDefinedTimingFields(
  timeoutMs: number | undefined,
  heartbeatIntervalMs: number | undefined,
  heartbeatTimeoutMs: number | undefined,
): {
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
} {
  const out: {
    timeoutMs?: number;
    heartbeatIntervalMs?: number;
    heartbeatTimeoutMs?: number;
  } = {};
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  if (heartbeatIntervalMs !== undefined) {
    out.heartbeatIntervalMs = heartbeatIntervalMs;
  }
  if (heartbeatTimeoutMs !== undefined) {
    out.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }
  return out;
}

function applyOptionalTiming(
  normalized: NormalizedRoomInit,
  timing: ReturnType<typeof pickDefinedTimingFields>,
): void {
  if (timing.timeoutMs !== undefined) normalized.timeoutMs = timing.timeoutMs;
  if (timing.heartbeatIntervalMs !== undefined) {
    normalized.heartbeatIntervalMs = timing.heartbeatIntervalMs;
  }
  if (timing.heartbeatTimeoutMs !== undefined) {
    normalized.heartbeatTimeoutMs = timing.heartbeatTimeoutMs;
  }
}

/** Strip `module`, callbacks, and recovery hook; use with {@link normalizeRoomInit}. */
export function peelRoomConfigCore(
  config: RoomConfig,
): RoomConfigCore {
  const {
    module: _m,
    onUnresolvedPersistenceCommand: _u,
    onTimeout: _1,
    onError: _2,
    onSync: _3,
    onCommit: _4,
    onReject: _5,
    onAuthorityChange: _6,
    onWireAuthFailure: _7,
    onPersistenceError: _8,
    ...core
  } = config;
  return core;
}

/**
 * Validates {@link RoomConfigCore} into the normalized init payload for `Room`.
 */
export function normalizeRoomInit(
  config: RoomConfigCore,
): NormalizedRoomInit {
  validateRoomConfig(config);
  const peerId = peerIdFromSecretSeed(config.secretSeed);
  const bootstrap = roomToBootstrap(config);
  const security = {
    roomSecret: config.roomSecret,
    secretSeed: config.secretSeed,
    ...(config.peerFingerprints !== undefined
      ? { peerFingerprints: config.peerFingerprints }
      : {}),
  };
  const coreInit: RoomCoreInitConfig = {
    topic: config.topic,
    peerId,
    bootstrap,
    security,
  };
  if (config.timeoutMs !== undefined) coreInit.timeoutMs = config.timeoutMs;
  validateRoomInitConfig(coreInit);

  const normalized: NormalizedRoomInit = {
    topic: config.topic,
    peerId,
    bootstrap,
    transport: config.transport,
    persistence: config.persistence,
    security,
  };
  applyOptionalTiming(
    normalized,
    pickDefinedTimingFields(
      config.timeoutMs,
      config.heartbeatIntervalMs,
      config.heartbeatTimeoutMs,
    ),
  );
  return normalized;
}
