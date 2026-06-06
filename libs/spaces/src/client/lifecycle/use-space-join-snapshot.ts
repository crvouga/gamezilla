import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { useQuery } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

export type SpaceJoinSnapshotStatus =
  | 'loading'
  | 'live'
  | 'ended'
  | 'unavailable';

export type SpaceJoinSnapshot = {
  status: SpaceJoinSnapshotStatus;
  joinable: boolean;
};

export function useSpaceJoinSnapshot(spaceId: string): SpaceJoinSnapshot {
  const { entities, isLoading } = useQuery({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    limit: 1,
  });

  return useMemo((): SpaceJoinSnapshot => {
    if (spaceId.length === 0) {
      return { status: 'unavailable', joinable: false };
    }
    if (isLoading) {
      return { status: 'loading', joinable: false };
    }
    const entity = entities[0];
    if (entity === undefined) {
      return { status: 'unavailable', joinable: false };
    }
    const hostId = SpaceAttr.hostId.from(entity.attributes);
    if (hostId === null) {
      return { status: 'unavailable', joinable: false };
    }
    const endedAt = SpaceAttr.endedAt.from(entity.attributes);
    if (endedAt !== null) {
      return { status: 'ended', joinable: false };
    }
    return { status: 'live', joinable: true };
  }, [spaceId, isLoading, entities]);
}
