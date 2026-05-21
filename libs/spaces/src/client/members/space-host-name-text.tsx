import { UserDisplayName } from '@libs/profile/client/user-display-name';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import type { SxProps, TextVariant } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceHostNameTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/** Display name of a space's host, by space id. */
export function SpaceHostNameText({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostNameTextProps): ReactNode {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.hostId,
  });
  return (
    <UserDisplayName
      profileId={hostId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
