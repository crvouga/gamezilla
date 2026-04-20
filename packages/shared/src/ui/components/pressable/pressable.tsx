/**
 * `Pressable` -- themed pressable with `sx` prop.
 *
 * Wraps React Native `Pressable` and applies an opacity feedback on press.
 *
 * @example
 * ```tsx
 * <Pressable sx={{ p: 3, background: 'surface', borderRadius: 8 }} onPressIn={handlePress}>
 *   <Text>Tap me</Text>
 * </Pressable>
 * ```
 */

import { forwardRef } from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type View,
} from 'react-native';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';

export type PressableProps = RNPressableProps & {
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxProps;
};

export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  { sx: sxProp, style, ...rest },
  ref
) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;

  return (
    <RNPressable
      ref={ref}
      style={(state) => {
        const pressedStyle = state.pressed ? { opacity: 0.7 } : undefined;
        const resolved = typeof style === 'function' ? style(state) : style;
        return [sxStyle, resolved, pressedStyle];
      }}
      {...rest}
    />
  );
});
