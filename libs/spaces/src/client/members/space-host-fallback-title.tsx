import { optionalProps } from '@pkgs/ui/components/optional-props';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@libs/profile/shared/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceHostFallbackTitleProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Localized fallback title `${hostName}'s space` for a space that hasn't been
 * explicitly named. Resolves the host id and host's display name inline.
 *
 * Renders an empty string when the host id is unknown (row not synced yet);
 * keeps the slot in place so layout doesn't shift when the title resolves.
 */
export function SpaceHostFallbackTitle({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostFallbackTitleProps): ReactNode {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.hostId,
  });
  if (hostId === null) {
    return (
      <Text
        {...optionalProps({ variant, sx, numberOfLines })}
        label={EMPTY_LABEL}
      />
    );
  }
  return (
    <SpaceHostFallbackTitleResolved
      hostId={hostId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}

const EMPTY_LABEL = '';

function SpaceHostFallbackTitleResolved({
  hostId,
  variant,
  sx,
  numberOfLines,
}: {
  hostId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
}): ReactNode {
  const { t } = useLingui();
  const hostDisplayName = useQueryAttribute({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: hostId,
    attribute: ProfileAttr.displayName,
  });
  return (
    <Text
      {...optionalProps({ variant, sx, numberOfLines })}
      label={t`${hostDisplayName}'s space`}
    />
  );
}
