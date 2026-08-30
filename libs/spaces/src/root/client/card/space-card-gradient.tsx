import { Box, type SxInput, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

export const SPACE_CARD_BORDER_RADIUS = 16;

export function useSpaceCardGradientColors(): readonly [string, string] {
  const theme = useTheme();
  const fill = theme.colors.tintActive;
  return [fill, fill];
}

export type SpaceCardGradientBoxProps = {
  children: ReactNode;
  sx?: SxInput;
  testID?: string;
};

/** Flat tint surface — nuclear overhaul (no LinearGradient / elevation). */
export function SpaceCardGradientBox({
  children,
  sx,
  testID,
}: SpaceCardGradientBoxProps): ReactNode {
  const [fill] = useSpaceCardGradientColors();

  return (
    <Box
      {...(testID !== undefined ? { testID } : {})}
      sx={[
        {
          backgroundColor: fill,
          borderRadius: SPACE_CARD_BORDER_RADIUS,
        },
        sx,
      ]}
    >
      {children}
    </Box>
  );
}
