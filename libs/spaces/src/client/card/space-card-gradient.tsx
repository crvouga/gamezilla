import { GradientBox, useTheme, type SxProps } from '@pkgs/ui';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export const SPACE_CARD_BORDER_RADIUS = 16;

export const SPACE_CARD_GRADIENT_START = { x: 0, y: 0 } as const;
export const SPACE_CARD_GRADIENT_END = { x: 1, y: 1 } as const;

/* eslint-disable lingui/no-unlocalized-strings -- HSLA design tokens, not user-facing copy */
const SPACE_CARD_GRADIENT_DARK_START = 'hsla(221, 72%, 52%, 1)';
const SPACE_CARD_GRADIENT_DARK_END = 'hsla(226, 68%, 42%, 1)';

export function useSpaceCardGradientColors(): readonly [string, string] {
  const theme = useTheme();
  if (theme.colorScheme === 'dark') {
    return [SPACE_CARD_GRADIENT_DARK_START, SPACE_CARD_GRADIENT_DARK_END];
  }
  return [theme.colors.tintHover, theme.colors.tintActive];
}

export type SpaceCardGradientBoxProps = {
  children: ReactNode;
  sx?: SxProps;
  style?: StyleProp<ViewStyle>;
};

export function SpaceCardGradientBox({
  children,
  sx,
  style,
}: SpaceCardGradientBoxProps): ReactNode {
  const colors = useSpaceCardGradientColors();

  return (
    <GradientBox
      colors={colors}
      start={SPACE_CARD_GRADIENT_START}
      end={SPACE_CARD_GRADIENT_END}
      {...(sx !== undefined ? { sx } : {})}
      style={style}
    >
      {children}
    </GradientBox>
  );
}
