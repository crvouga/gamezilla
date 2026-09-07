import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';

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
export function SpaceHostFallbackTitle(
  props: SpaceHostFallbackTitleProps
): JSX.Element {
  const label = useSpaceDisplayTitle(props.spaceId);
  return (
    <Text
      variant={props.variant}
      sx={props.sx}
      numberOfLines={props.numberOfLines}
      label={label()}
    />
  );
}
