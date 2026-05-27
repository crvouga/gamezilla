/**
 * `Card` -- a surface container with scheme-aware elevation.
 *
 * Defaults to elevation level 1 with the active theme's `surface` token.
 * In dark mode `theme.elevation()` returns a recommended lift -- the card
 * picks up `surfaceElevated` / `surfaceOverlay` at higher levels so it
 * stays legible even when shadows are faint.
 *
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
import { View, type ViewProps } from 'react-native';
import { useTheme, type SxProps } from '../../theme';
import { borderRadius, type ElevationLevel } from '../../theme/scale';

export type CardProps = ViewProps & {
  /** Shadow depth 0-5. Defaults to 1. */
  elevation?: ElevationLevel;
  /** Utility-first style shorthand. */
  sx?: SxProps;
};

export const Card = forwardRef<View, CardProps>(function Card(
  { elevation: level = 1, sx: sxProp, style, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const shadow = theme.elevation(level);
  const lifted = shadow.backgroundColor ?? theme.colors.surface;

  return (
    <View
      ref={ref}
      style={[
        sxStyle,
        style,
        {
          backgroundColor: lifted,
          borderRadius: borderRadius.lg,
          borderWidth: level === 0 ? 1 : 0,
          borderColor: theme.colors.border,
          ...(shadow.boxShadow ? { boxShadow: shadow.boxShadow } : {}),
          ...(shadow.elevation !== undefined
            ? { elevation: shadow.elevation }
            : {}),
        },
      ]}
      {...rest}
    />
  );
});
