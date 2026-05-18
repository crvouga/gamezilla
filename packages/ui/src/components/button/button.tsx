/**
 * `Button` -- themed pressable button with three intents and three sizes.
 *
 * Renders an arcade-style raised button: a vertical gradient fill (lighter
 * top, darker bottom) sits on a hard offset shadow that gives a 3D "skirt"
 * underneath. A faint highlight overlay across the upper half adds gloss,
 * and pressing translates the face down by the depth so the skirt
 * disappears -- mimicking a physical key being pushed in.
 *
 * `primary`, `danger`, and `neutral` intents pull their gradient stops
 * from the active theme. `primary` and `danger` use white label and icon
 * color in both light and dark themes.
 *
 * Vendor-branded buttons (e.g. "Sign in with Google", "Sign in with Apple")
 * have their own component because their colors, padding, label, and logo
 * are dictated by external branding guidelines and cannot be expressed via
 * this generic API.
 *
 * @example
 * ```tsx
 * <Button title="Save" intent="primary" size="md" onPress={save} />
 * <Button title="Delete" intent="danger" onPress={del} />
 * <Button title="Cancel" intent="neutral" onPress={cancel} />
 * ```
 */

import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, View, type ColorValue } from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Spinner } from '../spinner';
import { Text } from '../text';

export type ButtonIntent = 'primary' | 'danger' | 'neutral';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  /** Button label. */
  title: ReactNode;
  onPress?: () => void;
  /** Color/role of the button. Defaults to `"primary"`. */
  intent?: ButtonIntent;
  /** Size preset. Defaults to `"md"`. */
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label. */
  startIcon?: ReactNode;
  /** Rendered after the label. */
  endIcon?: ReactNode;
  /**
   * Apply a `flex` value to the outer button so it can fill or share space
   * inside a flex container (e.g. `flex={1}` for an equal-width row item).
   */
  flex?: number;
};

/**
 * Foreground color (label, spinner, suggested icon) applied on top of the
 * gradient face. Exposed so consumers passing `startIcon` / `endIcon` can
 * tint their icons to match the label without re-deriving it.
 */
export function buttonForegroundColor(
  theme: Theme,
  isDisabled: boolean
): string {
  if (isDisabled) {
    return theme.colors.textSecondary;
  }
  return ON_GRADIENT_WHITE;
}

/** Pixels of 3D depth: the height of the dark skirt visible below the face. */
const DEPTH = 4;

/** Chunky padding + capsule-leaning radii so buttons read as physical controls. */
const sizeMap = {
  sm: { py: 2, px: 3, borderRadius: borderRadius.md, minHeight: 40 },
  md: { py: 3, px: 4, borderRadius: borderRadius.lg, minHeight: 52 },
  lg: { py: 4, px: 5, borderRadius: borderRadius.lg, minHeight: 64 },
} as const;

const ON_GRADIENT_WHITE = '#ffffff';
/** Soft white overlay across the top half mimicking light hitting the face. */
const HIGHLIGHT_OVERLAY = 'rgba(255, 255, 255, 0.18)';
/** Hard offset shadow color: gives the skirt a darker rim of the same hue. */
const SHADOW_HARD = 'rgba(0, 0, 0, 0.32)';
/** Soft drop shadow under the skirt for grounding. */
const SHADOW_SOFT = 'rgba(0, 0, 0, 0.18)';

const GRADIENT_TOKENS_BY_INTENT = {
  primary: ['gradientPrimaryStart', 'gradientPrimaryEnd'],
  danger: ['gradientDangerStart', 'gradientDangerEnd'],
  neutral: ['gradientNeutralStart', 'gradientNeutralEnd'],
} as const satisfies Record<ButtonIntent, readonly [string, string]>;

function resolveGradientStops(
  theme: Theme,
  intent: ButtonIntent,
  isDisabled: boolean
): readonly [ColorValue, ColorValue] {
  if (isDisabled) {
    return [theme.colors.disabled, theme.colors.disabled];
  }
  const [startToken, endToken] = GRADIENT_TOKENS_BY_INTENT[intent];
  return [theme.colors[startToken], theme.colors[endToken]];
}

function resolveShadow(pressed: boolean, isDisabled: boolean): string {
  if (pressed || isDisabled) return 'none';
  return `0px ${DEPTH}px 0px ${SHADOW_HARD}, 0px ${DEPTH + 2}px 8px ${SHADOW_SOFT}`;
}

export function Button({
  title,
  onPress,
  intent = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  flex,
}: ButtonProps) {
  const theme = useTheme();
  const s = sizeMap[size];
  const isDisabled = disabled || loading;
  const stops = resolveGradientStops(theme, intent, isDisabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={() => ({
        borderRadius: s.borderRadius,
        userSelect: 'none',
        ...(flex !== undefined ? { flex } : {}),
      })}
    >
      {({ pressed }) => (
        <ButtonFace
          stops={stops}
          radius={s.borderRadius}
          py={s.py}
          px={s.px}
          minHeight={s.minHeight}
          pressed={pressed && !isDisabled}
          isDisabled={isDisabled}
        >
          <ButtonContent
            title={title}
            isDisabled={isDisabled}
            loading={loading}
            startIcon={startIcon}
            endIcon={endIcon}
          />
        </ButtonFace>
      )}
    </Pressable>
  );
}

function ButtonFace({
  stops,
  radius,
  py,
  px,
  minHeight,
  pressed,
  isDisabled,
  children,
}: {
  stops: readonly [ColorValue, ColorValue];
  radius: number;
  py: number;
  px: number;
  minHeight: number;
  pressed: boolean;
  isDisabled: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: radius,
        transform: [{ translateY: pressed ? DEPTH : 0 }],
        boxShadow: resolveShadow(pressed, isDisabled),
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      <LinearGradient
        colors={stops}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={theme.sx({
          py,
          px,
          minHeight,
          borderRadius: radius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          overflow: 'hidden',
          position: 'relative',
        })}
      >
        <ButtonHighlight radius={radius} visible={!isDisabled} />
        {children}
      </LinearGradient>
    </View>
  );
}

function ButtonHighlight({
  radius,
  visible,
}: {
  radius: number;
  visible: boolean;
}): ReactNode {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        backgroundColor: HIGHLIGHT_OVERLAY,
      }}
    />
  );
}

function ButtonContent({
  title,
  isDisabled,
  loading,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  isDisabled: boolean;
  loading: boolean;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  const theme = useTheme();
  const fg = buttonForegroundColor(theme, isDisabled);
  if (loading) return <Spinner size="small" color={fg} />;
  return (
    <>
      {startIcon !== undefined ? <View>{startIcon}</View> : null}
      <Text variant="heading" style={{ color: fg }} label={title} />
      {endIcon !== undefined ? <View>{endIcon}</View> : null}
    </>
  );
}
