import { UserDisplayName } from '@gamezilla/client/profile/user-display-name';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import type { SxProps, TextVariant } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
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
    attributeKey: SpaceAttr.hostId.key,

    parse: SpaceAttr.hostId.parse,
  });
  return (
    <UserDisplayName
      profileId={hostId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
