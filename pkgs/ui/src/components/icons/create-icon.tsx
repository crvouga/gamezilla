import type { ComponentType } from 'react';

import { type SxInput, useOnColor } from '../../theme';
import { Box } from '../box';

export type IconProps = {
  size?: number;
  /** When omitted, inherits on-color context or theme `icon` token. */
  color?: string;
  strokeWidth?: number;
  sx?: SxInput;
  accessibilityLabel?: string;
  testID?: string;
};

export type IconComponent = ComponentType<IconProps>;

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE_WIDTH = 2;

type LucideIconLike = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export function createIcon(LucideIcon: LucideIconLike): IconComponent {
  function Icon({
    size = DEFAULT_SIZE,
    color,
    strokeWidth = DEFAULT_STROKE_WIDTH,
    sx,
    accessibilityLabel,
    testID,
  }: IconProps) {
    const onColor = useOnColor();
    const resolvedColor = color ?? onColor.icon;
    return (
      <Box
        sx={[{ alignItems: 'center', justifyContent: 'center' }, sx]}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <LucideIcon
          size={size}
          color={resolvedColor}
          strokeWidth={strokeWidth}
        />
      </Box>
    );
  }
  return Icon;
}
