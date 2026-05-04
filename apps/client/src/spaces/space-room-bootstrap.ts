import {
  SpaceMembershipAttr,
  type SpaceMembershipRole,
} from '@gamezilla/domain/spaces/space-entities';
import type { Entity } from '@gamezilla/patch-db/interface';

import type { SpaceMemberRow } from './types';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function nonEmptyString(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.length > 0;
}

function findHostMember(
  members: SpaceMemberRow[],
  hostDeviceId: string | null
): SpaceMemberRow | undefined {
  if (!nonEmptyString(hostDeviceId)) return undefined;
  return members.find((m) => m.deviceId === hostDeviceId);
}

function readKeysFromMembershipEntity(
  entity: Entity
): { peer: string | null; pub: string | null } {
  const attrs = entity.attributes as Record<string, unknown>;
  return {
    peer: readStringAttr(attrs, SpaceMembershipAttr.peerId),
    pub: readStringAttr(attrs, SpaceMembershipAttr.peerPublicKey),
  };
}

function mergeHostKeysFromSelfMembership(args: {
  peer: string | null;
  pub: string | null;
  hostDeviceId: string | null;
  selfDeviceId: string;
  membershipEntity: Entity | null;
}): { peer: string | null; pub: string | null } {
  const { peer, pub, hostDeviceId, selfDeviceId, membershipEntity } = args;
  if (peer !== null && pub !== null) {
    return { peer, pub };
  }
  if (
    !nonEmptyString(hostDeviceId) ||
    hostDeviceId !== selfDeviceId ||
    membershipEntity === null
  ) {
    return { peer, pub };
  }
  const fromMem = readKeysFromMembershipEntity(membershipEntity);
  return {
    peer: fromMem.peer ?? peer,
    pub: fromMem.pub ?? pub,
  };
}

function resolveHostRoomKeys(args: {
  members: SpaceMemberRow[];
  hostDeviceId: string | null;
  selfDeviceId: string;
  membershipEntity: Entity | null;
}): { peer: string | null; pub: string | null } {
  const row = findHostMember(args.members, args.hostDeviceId);
  const peer = row?.peerRoomId ?? null;
  const pub = row?.peerPublicKeyB64 ?? null;
  return mergeHostKeysFromSelfMembership({
    peer,
    pub,
    hostDeviceId: args.hostDeviceId,
    selfDeviceId: args.selfDeviceId,
    membershipEntity: args.membershipEntity,
  });
}

export type SpaceRoomBootstrap = {
  spaceId: string;
  role: SpaceMembershipRole;
  hostRoomPeerId: string;
  hostRoomPublicKey: string;
  phantomPeerId: string;
  phantomPublicKey: string;
};

export function computeSpaceRoomBootstrap(args: {
  spaceId: string | undefined;
  spaceLive: boolean;
  role: SpaceMembershipRole | null;
  phantomPeerId: string | null;
  phantomPublicKey: string | null;
  members: SpaceMemberRow[];
  hostDeviceId: string | null;
  selfDeviceId: string;
  membershipEntity: Entity | null;
}): SpaceRoomBootstrap | null {
  if (
    !nonEmptyString(args.spaceId) ||
    !args.spaceLive ||
    args.role === null
  ) {
    return null;
  }

  const hk = resolveHostRoomKeys({
    members: args.members,
    hostDeviceId: args.hostDeviceId,
    selfDeviceId: args.selfDeviceId,
    membershipEntity: args.membershipEntity,
  });

  if (
    !nonEmptyString(args.phantomPeerId) ||
    !nonEmptyString(args.phantomPublicKey) ||
    !nonEmptyString(hk.peer) ||
    !nonEmptyString(hk.pub)
  ) {
    return null;
  }

  return {
    spaceId: args.spaceId,
    role: args.role,
    hostRoomPeerId: hk.peer,
    hostRoomPublicKey: hk.pub,
    phantomPeerId: args.phantomPeerId,
    phantomPublicKey: args.phantomPublicKey,
  };
}
