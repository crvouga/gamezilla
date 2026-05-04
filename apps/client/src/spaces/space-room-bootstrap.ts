import type { SpaceMembershipRole } from '@gamezilla/domain/spaces/space-entities';

function nonEmptyString(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.length > 0;
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
  hostRoomPeerId: string | null;
  hostRoomPublicKey: string | null;
}): SpaceRoomBootstrap | null {
  if (!nonEmptyString(args.spaceId) || !args.spaceLive || args.role === null) {
    return null;
  }

  if (
    !nonEmptyString(args.phantomPeerId) ||
    !nonEmptyString(args.phantomPublicKey) ||
    !nonEmptyString(args.hostRoomPeerId) ||
    !nonEmptyString(args.hostRoomPublicKey)
  ) {
    return null;
  }

  return {
    spaceId: args.spaceId,
    role: args.role,
    hostRoomPeerId: args.hostRoomPeerId,
    hostRoomPublicKey: args.hostRoomPublicKey,
    phantomPeerId: args.phantomPeerId,
    phantomPublicKey: args.phantomPublicKey,
  };
}
