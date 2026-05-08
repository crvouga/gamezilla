import { UserProfileAvatar } from '@gamezilla/client/profile/user-profile-avatar';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceHostAvatarProps = {
  spaceId: string;
  size: number;
  vividBackdrop?: boolean;
};

/** Avatar of the host of a space, by space id. */
export function SpaceHostAvatar({
  spaceId,
  size,
  vividBackdrop,
}: SpaceHostAvatarProps): ReactNode {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId.key,

    parse: SpaceAttr.hostId.parse,
  });
  return (
    <UserProfileAvatar
      profileId={hostId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
