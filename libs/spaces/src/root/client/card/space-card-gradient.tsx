import { Box, type ComponentDataSet, type SxInput, useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export const SPACE_CARD_BORDER_RADIUS = 16;

export function useSpaceCardGradientColors(): readonly [string, string] {
  const theme = useTheme();
  const fill = theme.colors.tintActive;
  return [fill, fill];
}

export type SpaceCardGradientBoxProps = {
  children: JSX.Element;
  sx?: SxInput;
  dataSet?: ComponentDataSet;
};

/** Flat tint surface — nuclear overhaul (no LinearGradient / elevation). */
export function SpaceCardGradientBox(
  props: SpaceCardGradientBoxProps
): JSX.Element {
  const [fill] = useSpaceCardGradientColors();

  return (
    <Box
      {...(props.dataSet !== undefined ? { dataSet: props.dataSet } : {})}
      sx={[
        {
          backgroundColor: fill,
          borderRadius: SPACE_CARD_BORDER_RADIUS,
        },
        props.sx,
      ]}
    >
      {props.children}
    </Box>
  );
}
