/**
 * `Pressable` -- themed pressable with `sx` prop and refined press feedback.
 *
 * The default `feedback="tint"` mode layers a translucent overlay (using the
 * theme's `interactiveHover` / `interactivePress` tokens) on top of the
 * children when the user hovers (desktop web only) or presses. Hover is gated
 * behind {@link useHoverCapable} so touch devices never keep a sticky tint
 * after tap.
 */

import { forwardRef, type ReactNode, useEffect, useState } from 'react';
import {
  type PressableStateCallbackType,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type View as RNView,
} from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import {
  flattenSx,
  type SxInput,
  type SxRadius,
  useHostSx,
  useHoverCapable,
  useTheme,
} from '../../theme';
import { resolveRadius } from '../../theme/sx-resolve';
import { Box } from '../box';

export type PressableFeedback = 'tint' | 'opacity' | 'none';

export type PressableSx = SxInput | ((state: { pressed: boolean }) => SxInput);

export type PressableProps = Omit<RNPressableProps, 'style'> & {
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: PressableSx;
  /**
   * Visual press feedback. Defaults to `'tint'`.
   */
  feedback?: PressableFeedback;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
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

function restSx(sx: PressableSx | undefined): SxInput {
  if (typeof sx === 'function') return sx({ pressed: false });
  return sx;
}

export const Pressable = forwardRef<RNView, PressableProps>(function Pressable(
  {
    sx: sxProp,
    feedback = 'tint',
    children,
    onHoverIn,
    onHoverOut,
    dataSet,
    ...rest
  },
  ref
) {
  const theme = useTheme();
  const hoverCapable = useHoverCapable();
  const [hovered, setHovered] = useState(false);
  const host = useHostSx('Pressable', restSx(sxProp), dataSet);
  const overlayRadius = resolveRadius(
    flattenSx(restSx(sxProp))?.borderRadius as SxRadius | undefined
  );

  useEffect(() => {
    if (!hoverCapable) setHovered(false);
  }, [hoverCapable]);

  return (
    <RNPressable
      ref={ref}
      onHoverIn={(e) => {
        if (hoverCapable) setHovered(true);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        onHoverOut?.(e);
      }}
      style={(state) => {
        const resolved = typeof sxProp === 'function' ? sxProp(state) : sxProp;
        const pressed =
          feedback === 'opacity' && state.pressed
            ? { opacity: PRESSED_OPACITY }
            : false;
        return theme.sx([resolved, pressed]);
      }}
      {...rest}
      {...host.dataSet}
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
    <Box
      pointerEvents="none"
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundColor: color,
        ...(radius !== undefined ? { borderRadius: radius } : {}),
      }}
    />
  );
}
