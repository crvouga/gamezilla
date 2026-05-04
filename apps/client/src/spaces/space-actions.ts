import { loadOrCreateHostRoomSeed } from '@gamezilla/client/auth/peer-identity';
import { useSecureStorage } from '@gamezilla/client/runtime/runtime-hooks';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { usePatchDb } from '@gamezilla/patch-db/react';
import {
  derivePhantomSecretSeed,
  encodeKeyB64,
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
} from '@gamezilla/room';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { useCallback } from 'react';

import { useSelfAuthIdentity } from './device-display-resolution';

type WritePatches = Parameters<PatchDb['write']>[0];

export class SpaceActionAuthError extends Error {
  readonly __space_action_auth = true as const;

  constructor() {
    super('Sign in to create or join a space');
    this.name = 'SpaceActionAuthError';
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

async function readActiveHostMembership(
  db: PatchDb,
  accountId: string
): Promise<{ spaceId: string } | null> {
  const [memRes] = await db.read([
    {
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      entityId: accountId,
    },
  ]);
  const mem = memRes?.entities[0];
  if (!mem) return null;
  const sid = mem.attributes[SpaceMembershipAttr.spaceId];
  const role = mem.attributes[SpaceMembershipAttr.role];
  const leftAt = mem.attributes[SpaceMembershipAttr.leftAt];
  if (leftAt) return null;
  if (role !== 'host') return null;
  if (typeof sid !== 'string' || sid.length === 0) return null;
  return { spaceId: sid };
}

function endHostedSpacePatches(
  hostSpaceId: string,
  hostAccountId: string,
  now: string
): WritePatches {
  return [
    {
      entityId: hostSpaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: {
        [SpaceAttr.endedAt]: now,
        [SpaceAttr.hostId]: hostAccountId,
      },
    },
    {
      entityId: hostAccountId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: { [SpaceMembershipAttr.leftAt]: now },
    },
  ];
}

async function createSpaceAction(
  db: PatchDb,
  accountId: string,
  storage: SecureStorage
): Promise<string | undefined> {
  const now = isoNow();
  const patches: WritePatches = [];

  const hosted = await readActiveHostMembership(db, accountId);
  if (hosted) {
    patches.push(...endHostedSpacePatches(hosted.spaceId, accountId, now));
  }

  const spaceId = crypto.randomUUID();
  const hostSeed = await loadOrCreateHostRoomSeed(storage, spaceId);
  const hostPub = publicKeyFromSecretSeed(hostSeed);
  const hostRoomPeerId = peerIdFromPublicKey(hostPub);
  const hostRoomPublicKeyB64 = encodeKeyB64(hostPub);

  const phantomSeed = derivePhantomSecretSeed(spaceId);
  const phantomPub = publicKeyFromSecretSeed(phantomSeed);
  const phantomPeerId = peerIdFromPublicKey(phantomPub);
  const phantomPublicKeyB64 = encodeKeyB64(phantomPub);

  patches.push(
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: {
        [SpaceAttr.hostId]: accountId,
        [SpaceAttr.createdAt]: now,
        [SpaceAttr.phantomPeerId]: phantomPeerId,
        [SpaceAttr.phantomPublicKey]: phantomPublicKeyB64,
        [SpaceAttr.hostRoomPeerId]: hostRoomPeerId,
        [SpaceAttr.hostRoomPublicKey]: hostRoomPublicKeyB64,
        [SpaceAttr.memberUserIds]: [accountId],
      },
    },
    {
      entityId: accountId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: {
        [SpaceMembershipAttr.spaceId]: spaceId,
        [SpaceMembershipAttr.role]: 'host',
        [SpaceMembershipAttr.joinedAt]: now,
        [SpaceMembershipAttr.leftAt]: null,
      },
    }
  );

  await db.write(patches);
  return spaceId;
}

async function joinSpaceAction(
  db: PatchDb,
  accountId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  const patches: WritePatches = [];
  const hosted = await readActiveHostMembership(db, accountId);
  if (hosted && hosted.spaceId !== spaceId) {
    patches.push(...endHostedSpacePatches(hosted.spaceId, accountId, now));
  }
  patches.push({
    entityId: accountId,
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    attributes: {
      [SpaceMembershipAttr.spaceId]: spaceId,
      [SpaceMembershipAttr.role]: 'guest',
      [SpaceMembershipAttr.joinedAt]: now,
      [SpaceMembershipAttr.leftAt]: null,
    },
  });
  await db.write(patches);
}

async function leaveSpaceAction(db: PatchDb, accountId: string): Promise<void> {
  await db.write([
    {
      entityId: accountId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: { [SpaceMembershipAttr.leftAt]: isoNow() },
    },
  ]);
}

async function endSpaceAction(
  db: PatchDb,
  accountId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  await db.write(endHostedSpacePatches(spaceId, accountId, now));
}

export function useSpaceActions() {
  const db = usePatchDb();
  const storage = useSecureStorage();
  const { selfAccountId } = useSelfAuthIdentity();

  const createSpace = useCallback(async () => {
    if (selfAccountId === null) {
      throw new SpaceActionAuthError();
    }
    return createSpaceAction(db, selfAccountId, storage);
  }, [db, selfAccountId, storage]);

  const joinSpace = useCallback(
    async (spaceId: string) => {
      if (selfAccountId === null) {
        throw new SpaceActionAuthError();
      }
      return joinSpaceAction(db, selfAccountId, spaceId);
    },
    [db, selfAccountId]
  );

  const leaveSpace = useCallback(async () => {
    if (selfAccountId === null) {
      throw new SpaceActionAuthError();
    }
    return leaveSpaceAction(db, selfAccountId);
  }, [db, selfAccountId]);

  const endSpace = useCallback(
    async (spaceId: string) => {
      if (selfAccountId === null) {
        throw new SpaceActionAuthError();
      }
      return endSpaceAction(db, selfAccountId, spaceId);
    },
    [db, selfAccountId]
  );

  return { createSpace, joinSpace, leaveSpace, endSpace };
}
