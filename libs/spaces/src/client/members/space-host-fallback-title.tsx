import { optionalProps } from '@pkgs/ui/components/optional-props';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { type ReactNode } from 'react';

import { useSpaceDisplayTitle } from '../use-space-display-title';

export type SpaceHostFallbackTitleProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Localized fallback title for a space that hasn't been explicitly named:
 * `${hostName}'s space`, or `Space ${suffix}` when the host username is missing.
 */
export function SpaceHostFallbackTitle({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostFallbackTitleProps): ReactNode {
  const label = useSpaceDisplayTitle(spaceId);
  return (
    <Text
      {...optionalProps({ variant, sx, numberOfLines })}
      label={label}
    />
  );
}
