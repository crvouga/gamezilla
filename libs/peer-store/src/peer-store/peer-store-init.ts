import { Assert } from '@gamezilla/lib/assert';
import {
  validatePeerStoreInitConfig,
  type PeerStoreCoreInitConfig,
} from './peer-store-config-validate';
import type {
  NormalizedPeerStoreInit,
  PeerBootstrap,
  PeerStoreAuthorityStrategy,
  PeerStoreInitConfig,
  PeerStoreLegacyInitConfig,
  PeerStoreRoomConfig,
} from './peer-store-types';
import {
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
} from './security/peer-crypto';

const crash: Assert = Assert.crash();

function peerIdFromSecretSeed(secretSeed: Uint8Array): string {
  const pub = publicKeyFromSecretSeed(secretSeed);
  return peerIdFromPublicKey(pub);
}

function validateRoomHostConfig(room: PeerStoreRoomConfig): void {
  crash.ok(room.role.type === 'host', 'expected host role');
  const { initialMembership, initialMemberPublicKeys } = room.role;
  const derivedPeerId = peerIdFromSecretSeed(room.secretSeed);
  crash.ok(
    derivedPeerId in initialMembership,
    'host role: initialMembership must include peer derived from secretSeed',
    { derivedPeerId }
  );
  const ids = Object.keys(initialMembership);
  crash.ok(
    ids.length >= 2,
    'host initialMembership must list at least 2 peers'
  );
  for (const id of ids) {
    crash.ok(
      id in initialMemberPublicKeys,
      'host initialMemberPublicKeys must cover initialMembership',
      {
        id,
      }
    );
  }
}

function validateRoomJoinConfig(room: PeerStoreRoomConfig): void {
  crash.ok(room.role.type === 'join', 'expected join role');
  const { initialMembership, initialMemberPublicKeys } = room.role.roomSnapshot;
  const ids = Object.keys(initialMembership);
  crash.ok(
    ids.length >= 2,
    'join roomSnapshot.initialMembership must list at least 2 peers'
  );
  for (const id of ids) {
    crash.ok(
      id in initialMemberPublicKeys,
      'join roomSnapshot.initialMemberPublicKeys must cover initialMembership',
      { id }
    );
  }
}

function validatePeerStoreRoomConfig(room: PeerStoreRoomConfig): void {
  crash.nonEmptyString(room.topic, 'room.topic must be non-empty');
  crash.nonEmptyString(room.roomSecret, 'room.roomSecret must be non-empty');
  crash.ok(
    room.secretSeed instanceof Uint8Array && room.secretSeed.length === 32,
    'room.secretSeed must be Uint8Array of length 32'
  );
  if (room.role.type === 'host') {
    validateRoomHostConfig(room);
  } else {
    validateRoomJoinConfig(room);
  }
  if (room.trustElectionTimeoutMs !== undefined) {
    crash.ok(
      room.trustElectionTimeoutMs > 0,
      'trustElectionTimeoutMs must be > 0'
    );
  }
}

function roomToBootstrap(room: PeerStoreRoomConfig): PeerBootstrap {
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

function isRoomConfig(
  config: PeerStoreInitConfig
): config is PeerStoreRoomConfig {
  return 'role' in config;
}

type ElectionOpts = {
  autoTrustElection: boolean;
  trustElectionTimeoutMs: number;
  authorityStrategy: PeerStoreAuthorityStrategy | undefined;
};

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

function applyOptionalTimingAndStrategy(
  normalized: NormalizedPeerStoreInit,
  timing: ReturnType<typeof pickDefinedTimingFields>,
  authorityStrategy: ElectionOpts['authorityStrategy'],
): void {
  if (timing.timeoutMs !== undefined) normalized.timeoutMs = timing.timeoutMs;
  if (timing.heartbeatIntervalMs !== undefined) {
    normalized.heartbeatIntervalMs = timing.heartbeatIntervalMs;
  }
  if (timing.heartbeatTimeoutMs !== undefined) {
    normalized.heartbeatTimeoutMs = timing.heartbeatTimeoutMs;
  }
  if (authorityStrategy !== undefined) {
    normalized.authorityStrategy = authorityStrategy;
  }
}

function normalizeRoomBranch(
  config: PeerStoreRoomConfig,
  election: ElectionOpts,
): NormalizedPeerStoreInit {
  validatePeerStoreRoomConfig(config);
  const peerId = peerIdFromSecretSeed(config.secretSeed);
  const bootstrap = roomToBootstrap(config);
  const security = {
    roomSecret: config.roomSecret,
    secretSeed: config.secretSeed,
    ...(config.peerFingerprints !== undefined
      ? { peerFingerprints: config.peerFingerprints }
      : {}),
  };
  const coreInit: PeerStoreCoreInitConfig = {
    topic: config.topic,
    peerId,
    bootstrap,
    security,
  };
  if (config.timeoutMs !== undefined) coreInit.timeoutMs = config.timeoutMs;
  validatePeerStoreInitConfig(coreInit);

  const normalized: NormalizedPeerStoreInit = {
    topic: config.topic,
    peerId,
    bootstrap,
    transport: config.transport,
    security,
    autoTrustElection: election.autoTrustElection,
    trustElectionTimeoutMs: election.trustElectionTimeoutMs,
  };
  applyOptionalTimingAndStrategy(
    normalized,
    pickDefinedTimingFields(
      config.timeoutMs,
      config.heartbeatIntervalMs,
      config.heartbeatTimeoutMs,
    ),
    election.authorityStrategy,
  );
  return normalized;
}

function normalizeLegacyBranch(
  legacy: PeerStoreLegacyInitConfig,
  election: ElectionOpts,
): NormalizedPeerStoreInit {
  validatePeerStoreInitConfig(legacy);
  const normalized: NormalizedPeerStoreInit = {
    topic: legacy.topic,
    peerId: legacy.peerId,
    bootstrap: legacy.bootstrap,
    transport: legacy.transport,
    security: legacy.security,
    autoTrustElection: election.autoTrustElection,
    trustElectionTimeoutMs: election.trustElectionTimeoutMs,
  };
  applyOptionalTimingAndStrategy(
    normalized,
    pickDefinedTimingFields(
      legacy.timeoutMs,
      legacy.heartbeatIntervalMs,
      legacy.heartbeatTimeoutMs,
    ),
    election.authorityStrategy,
  );
  return normalized;
}

/**
 * Validates and merges {@link PeerStoreRoomConfig} vs {@link PeerStoreLegacyInitConfig}
 * into a single normalized init payload for `PeerStore`.
 */
export function normalizePeerStoreInit(
  config: PeerStoreInitConfig
): NormalizedPeerStoreInit {
  const election: ElectionOpts = {
    autoTrustElection: config.autoTrustElection !== false,
    trustElectionTimeoutMs: config.trustElectionTimeoutMs ?? 10_000,
    authorityStrategy: config.authorityStrategy,
  };
  return isRoomConfig(config)
    ? normalizeRoomBranch(config, election)
    : normalizeLegacyBranch(config, election);
}
