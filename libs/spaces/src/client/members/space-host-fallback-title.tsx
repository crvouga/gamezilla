import { optionalProps } from '@pkgs/ui/components/optional-props';
import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { type ReactNode } from 'react';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostFallbackTitleProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Localized fallback title `${hostName}'s space` for a space that hasn't been
 * explicitly named. Host name always comes from the live `profiles` row.
 */
export function SpaceHostFallbackTitle({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostFallbackTitleProps): ReactNode {
  const host = useSpaceHostMembershipDisplay(spaceId);
  if (host === null) {
    return (
      <Text
        {...optionalProps({ variant, sx, numberOfLines })}
        label={EMPTY_LABEL}
      />
    );
  }
  return (
    <SpaceHostFallbackTitleResolved
      profileId={host.profileId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}

const EMPTY_LABEL = '';

function SpaceHostFallbackTitleResolved({
  profileId,
  variant,
  sx,
  numberOfLines,
}: {
  profileId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
}): ReactNode {
  const { t } = useLingui();
  const hostUsername = useProfileColumn(profileId, ProfileField.username);
  const hostName = hostUsername ?? '';
  return (
    <Text
      {...optionalProps({ variant, sx, numberOfLines })}
      label={t`${hostName}'s space`}
    />
  );
}
