import { optionalProps } from '@pkgs/ui/components/optional-props';
import { useProfileColumn, ProfileField } from '@libs/profile/client/use-profile-column';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';

export type SpaceHostFallbackTitleProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Localized fallback title `${hostName}'s space` for a space that hasn't been
 * explicitly named.
 */
export function SpaceHostFallbackTitle({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostFallbackTitleProps): ReactNode {
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  if (hostId === null || hostId.length === 0) {
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
  const hostDisplayName = useProfileColumn(hostId, ProfileField.displayName);
  const hostName = hostDisplayName ?? '';
  return (
    <Text
      {...optionalProps({ variant, sx, numberOfLines })}
      label={t`${hostName}'s space`}
    />
  );
}
