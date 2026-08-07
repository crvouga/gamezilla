import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';

import { useSpaceDisplayTitle } from '../use-space-display-title';

export type SpaceHostFallbackTitleProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Localized fallback title for a space that hasn't been explicitly named:
 * `${hostName}'s space`, or `Space` when the host username is still loading.
 */
export function SpaceHostFallbackTitle({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostFallbackTitleProps): ReactNode {
  const label = useSpaceDisplayTitle(spaceId);
  return (
    <Text {...optionalProps({ variant, sx, numberOfLines })} label={label} />
  );
}
