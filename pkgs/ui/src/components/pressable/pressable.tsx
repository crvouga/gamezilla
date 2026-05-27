/**
 * `Pressable` -- themed pressable with `sx` prop and refined press feedback.
 *
 * The default `feedback="tint"` mode layers a translucent overlay (using the
 * theme's `interactiveHover` / `interactivePress` tokens) on top of the
 * children when the user hovers (web) or presses. This reads as a real
 * interactive surface lift -- the same idiom Discord / Linear / Notion use --
 * instead of the old flat `opacity: 0.7` drop.
 *
 * Pass `feedback="opacity"` to fall back to the legacy opacity press, or
 * `feedback="none"` for a Pressable that ships no built-in visual feedback
 * (callers handle press state themselves via the `pressed` callback child).
 *
 * @example
 * ```tsx
 * <Pressable sx={{ p: 3, background: 'surface', borderRadius: 8 }} onPress={handlePress}>
 *   <Text>Tap me</Text>
 * </Pressable>
 * ```
 */

import { forwardRef, useState, type ReactNode } from 'react';
import {
  Pressable as RNPressable,
  View,
  type PressableProps as RNPressableProps,
  type PressableStateCallbackType,
  type View as RNView,
} from 'react-native';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';

export type PressableFeedback = 'tint' | 'opacity' | 'none';

export type PressableProps = RNPressableProps & {
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxProps;
  /**
   * Visual press feedback. Defaults to `'tint'` -- the modern overlay-tint
   * style. Use `'opacity'` for the legacy flat dim, or `'none'` when the
   * caller renders its own feedback (e.g. `Button` paints its own face).
   */
  feedback?: PressableFeedback;
};

const PRESSED_OPACITY = 0.7;

function resolveOverlayColor(
  state: PressableStateCallbackType,
  hovered: boolean,
  colors: { interactiveHover: string; interactivePress: string }
): string | null {
  if (state.pressed) return colors.interactivePress;
  if (hovered) return colors.interactiveHover;
  return null;
}

export const Pressable = forwardRef<RNView, PressableProps>(function Pressable(
  {
    sx: sxProp,
    style,
    feedback = 'tint',
    children,
    onHoverIn,
    onHoverOut,
    ...rest
  },
  ref
) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const overlayRadius =
    typeof sxProp?.borderRadius === 'number' ? sxProp.borderRadius : undefined;

  return (
    <RNPressable
      ref={ref}
      onHoverIn={(e) => {
        setHovered(true);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        onHoverOut?.(e);
      }}
      style={(state) => {
        const resolved = typeof style === 'function' ? style(state) : style;
        if (feedback === 'opacity') {
          const pressedStyle = state.pressed
            ? { opacity: PRESSED_OPACITY }
            : undefined;
          return [sxStyle, resolved, pressedStyle];
        }
        return [sxStyle, resolved];
      }}
      {...rest}
    >
      {(state) => (
        <>
          {typeof children === 'function' ? children(state) : children}
          {feedback === 'tint' ? (
            <PressableTintOverlay
              state={state}
              hovered={hovered}
              colors={theme.colors}
              radius={overlayRadius}
            />
          ) : null}
        </>
      )}
    </RNPressable>
  );
});

function PressableTintOverlay({
  state,
  hovered,
  colors,
  radius,
}: {
  state: PressableStateCallbackType;
  hovered: boolean;
  colors: { interactiveHover: string; interactivePress: string };
  radius: number | undefined;
}): ReactNode {
  const color = resolveOverlayColor(state, hovered, colors);
  if (!color) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: color,
        ...(radius !== undefined ? { borderRadius: radius } : {}),
      }}
    />
  );
}
