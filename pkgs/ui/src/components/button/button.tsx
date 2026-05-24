/**
 * `Button` -- themed pressable button with three intents and three sizes.
 *
 * Renders an arcade-style raised button: a vertical gradient fill (lighter
 * top, darker bottom) sits on a hard offset shadow that gives a 3D "skirt"
 * underneath, with a soft gloss across the top half and a faint inner
 * shading at the bottom.
 *
 * Press feedback is *opacity only* -- the face dims slightly on press.
 * The button never translates, scales, or otherwise animates its position
 * or size. Layout-affecting animations on tap targets cause cursor drift
 * and jitter; we deliberately avoid them.
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

/**
 * Chunky padding + capsule-leaning radii so buttons read as physical
 * controls. `text` carries the exact font size, line-height, and weight to
 * apply for each size -- we don't use a `Text` variant because variant
 * line-heights (e.g. 34 for `heading`) create vertical padding that pushes
 * the label off-center relative to icons.
 */
const sizeMap = {
  sm: {
    py: 2,
    px: 3,
    borderRadius: borderRadius.sm,
    minHeight: 42,
    text: { fontSize: 15, lineHeight: 18, fontWeight: '800' },
    iconGap: 1.5,
  },
  md: {
    py: 3,
    px: 4,
    borderRadius: borderRadius.sm,
    minHeight: 54,
    text: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
    iconGap: 2,
  },
  lg: {
    py: 4,
    px: 5,
    borderRadius: borderRadius.sm,
    minHeight: 64,
    text: { fontSize: 22, lineHeight: 26, fontWeight: '900' },
    iconGap: 2.5,
  },
} as const;

const ON_GRADIENT_WHITE = '#ffffff';
/**
 * Top inner highlight: a soft white gloss that fades to transparent. Sits
 * above the face gradient and bleeds smoothly into it.
 */
const HIGHLIGHT_TOP = 'rgba(255, 255, 255, 0.26)';
const HIGHLIGHT_BOTTOM = 'rgba(255, 255, 255, 0)';
/**
 * Bottom inner shading: deepens the lower edge of the face so it reads as
 * a slightly tilted surface rather than a flat sticker.
 */
const SHADE_TOP = 'rgba(0, 0, 0, 0)';
const SHADE_BOTTOM = 'rgba(0, 0, 0, 0.14)';
/** Inner stroke on the face: a hairline of brightness for surface definition. */
const FACE_INNER_STROKE = 'rgba(255, 255, 255, 0.22)';
/** Outer rim around the whole control: defines the silhouette against the page. */
const OUTER_RING = 'rgba(0, 0, 0, 0.16)';
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

/**
 * Composite elevation: outer rim for silhouette + hard depth shadow that
 * forms the 3D skirt + a soft drop shadow grounding the control against
 * the page. Stays stable across press states so the button never visually
 * jumps -- press feedback is handled via opacity in {@link ButtonFace}.
 * Disabled buttons collapse to just the rim.
 */
function resolveShadow(isDisabled: boolean): string {
  const rim = `0px 0px 0px 1px ${OUTER_RING}`;
  if (isDisabled) return rim;
  const depth = `0px ${DEPTH}px 0px ${SHADOW_HARD}`;
  const drop = `0px ${DEPTH + 4}px 12px ${SHADOW_SOFT}`;
  return `${rim}, ${depth}, ${drop}`;
}

/**
 * Press feedback is opacity-only. Disabled wins (most dimmed), then pressed.
 * Never translate or scale the button face -- it causes cursor drift on
 * web and the press target to shift under the user's finger on touch.
 */
function resolveOpacity(pressed: boolean, isDisabled: boolean): number {
  if (isDisabled) return 0.6;
  if (pressed) return 0.85;
  return 1;
}

type SizeSpec = (typeof sizeMap)[ButtonSize];

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
          size={s}
          pressed={pressed && !isDisabled}
          isDisabled={isDisabled}
        >
          <ButtonContent
            title={title}
            size={s}
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
  size,
  pressed,
  isDisabled,
  children,
}: {
  stops: readonly [ColorValue, ColorValue];
  size: SizeSpec;
  pressed: boolean;
  isDisabled: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const radius = size.borderRadius;
  // 3-stop gradient: hold the top color across the upper ~third of the face
  // so the transition reads as gentle shading on a real surface rather than
  // a two-tone split.
  const faceColors: readonly [ColorValue, ColorValue, ColorValue] = [
    stops[0],
    stops[0],
    stops[1],
  ];
  const faceLocations = [0, 0.35, 1] as const;
  return (
    <View
      style={{
        borderRadius: radius,
        boxShadow: resolveShadow(isDisabled),
        opacity: resolveOpacity(pressed, isDisabled),
      }}
    >
      <LinearGradient
        colors={faceColors}
        locations={faceLocations}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          theme.sx({
            py: size.py,
            px: size.px,
            minHeight: size.minHeight,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: size.iconGap,
            overflow: 'hidden',
            position: 'relative',
          }),
          {
            borderRadius: radius,
            borderWidth: isDisabled ? 0 : 1,
            borderColor: FACE_INNER_STROKE,
          },
        ]}
      >
        <ButtonGloss radius={radius} visible={!isDisabled} />
        <ButtonShade radius={radius} visible={!isDisabled} />
        {children}
      </LinearGradient>
    </View>
  );
}

function ButtonGloss({
  radius,
  visible,
}: {
  radius: number;
  visible: boolean;
}): ReactNode {
  if (!visible) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[HIGHLIGHT_TOP, HIGHLIGHT_BOTTOM]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '55%',
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
      }}
    />
  );
}

function ButtonShade({
  radius,
  visible,
}: {
  radius: number;
  visible: boolean;
}): ReactNode {
  if (!visible) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[SHADE_TOP, SHADE_BOTTOM]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45%',
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
      }}
    />
  );
}

function ButtonContent({
  title,
  size,
  isDisabled,
  loading,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  size: SizeSpec;
  isDisabled: boolean;
  loading: boolean;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  const theme = useTheme();
  const fg = buttonForegroundColor(theme, isDisabled);
  if (loading) return <Spinner color={fg} />;
  const iconBoxStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    height: size.text.lineHeight,
  } as const;
  return (
    <>
      {startIcon !== undefined ? (
        <View style={iconBoxStyle}>{startIcon}</View>
      ) : null}
      <Text
        variant="bodyBold"
        style={{
          color: fg,
          fontSize: size.text.fontSize,
          lineHeight: size.text.lineHeight,
          fontWeight: size.text.fontWeight,
          includeFontPadding: false,
          textAlignVertical: 'center',
        }}
        label={title}
      />
      {endIcon !== undefined ? (
        <View style={iconBoxStyle}>{endIcon}</View>
      ) : null}
    </>
  );
}
