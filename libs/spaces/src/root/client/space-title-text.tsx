import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';
import { SpaceHostFallbackTitle } from './members/space-host-fallback-title';

import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceTitleTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Renders the user-set title for a space, falling back to the localized
 * `${hostName}'s space` template when no custom title is set.
 */
export function SpaceTitleText({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceTitleTextProps): ReactNode {
  const customTitle = useSpaceColumn(spaceId, SpaceField.title);
  if (customTitle !== null && customTitle.length > 0) {
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
