import { SpaceHostFallbackTitle } from '@gamezilla/client/spaces/host/space-host-fallback-title';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { Text, type SxProps, type TextVariant } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceTitleTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Renders the user-set title for a space, falling back to the localized
 * `${hostName}'s space` template when no custom title is set.
 *
 * The fallback / non-fallback split is owned by this atom — hooks never
 * resolve the fallback themselves.
 */
export function SpaceTitleText({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceTitleTextProps): ReactNode {
  const customTitle = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.title.key,
    parse: SpaceAttr.title.parse,
  });
  if (customTitle !== null) {
    return (
      <Text
        {...optionalProps({ variant, sx, numberOfLines })}
        label={customTitle}
      />
    );
  }
  return (
    <SpaceHostFallbackTitle
      spaceId={spaceId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
