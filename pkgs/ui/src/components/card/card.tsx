/**
 * `Card` -- a surface container with scheme-aware elevation.
 *
 * Defaults to elevation level 1 with the active theme's `surface` token.
 * Pass `interactive` to opt into a hover-lift on web (one elevation step up,
 * via {@link Pressable}'s tint feedback). Use this for cards that respond
 * to clicks; static cards should leave it off.
 *
 * @example
 * ```tsx
 * <Card elevation={2} sx={{ p: 4 }}>
 *   <Text variant="subtitle">Title</Text>
 *   <Text>Card body content</Text>
 * </Card>
 * ```
 */

import { forwardRef } from 'react';
import type { View } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import { type ElevationLevel, type SxInput, useTheme } from '../../theme';
import { Box, type BoxProps } from '../box';

export type CardProps = Omit<BoxProps, 'sx'> & {
  /** Shadow depth 0-5. Defaults to 1. */
  elevation?: ElevationLevel;
  /** Utility-first style shorthand. */
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export const Card = forwardRef<View, CardProps>(function Card(
  { elevation: level = 1, sx, dataSet, ...rest },
  ref
) {
  const theme = useTheme();
  const shadow = theme.elevation(level);
  const lifted = shadow.backgroundColor ?? theme.colors.surface;
  return (
    <Box
      ref={ref}
      sx={[
        sx,
        {
          backgroundColor: lifted,
          borderRadius: 'lg',
          borderWidth: 1,
          borderColor: 'border',
          elevation: level,
        },
      ]}
      dataSet={{ component: 'Card', ...dataSet }}
      {...rest}
    />
  );
});
