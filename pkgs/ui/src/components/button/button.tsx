/**
 * `Button` -- themed pressable button with three intents and three sizes.
 *
 * Renders a refined two-tone gradient face that lifts off the surface via a
 * scheme-aware elevation. Hover brightens one ramp step; press shifts the
 * face down 1px and drops one shadow level, producing tactile feedback
 * without moving the outer Pressable's hit target.
 *
 * `primary` / `danger` / `neutral` intents pull their gradient stops from
 * the active theme (`tint` -> `tintActive` for primary; semantic gradients
 * for the others). The label color comes from the `onTint` token so it
 * reads correctly against the chosen background in both schemes.
 *
 * Vendor-branded buttons (e.g. "Sign in with Google", "Sign in with Apple")
 * have their own component because their colors, padding, label, and logo
 * are dictated by external branding guidelines.
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
import { Platform, View, type ColorValue } from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { Text } from '../text';

export type ButtonIntent = 'primary' | 'danger' | 'neutral';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
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
 * tint their icons to match the label.
 */
export function buttonForegroundColor(
  theme: Theme,
  intent: ButtonIntent,
  isDisabled: boolean
): string {
  if (isDisabled) return theme.colors.textSecondary;
  return intent === 'neutral' ? theme.colors.text : theme.colors.onTint;
}

const sizeMap = {
  sm: {
    py: 2,
    px: 3,
    borderRadius: borderRadius.md,
    minHeight: 36,
    text: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
    iconGap: 1.5,
  },
  md: {
    py: 3,
    px: 4,
    borderRadius: borderRadius.md,
    minHeight: 44,
    text: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
    iconGap: 2,
  },
  lg: {
    py: 4,
    px: 5,
    borderRadius: borderRadius.lg,
    minHeight: 52,
    text: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
    iconGap: 2,
  },
} as const;

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
  if (intent === 'neutral') {
    return [theme.colors.surfaceElevated, theme.colors.surface];
  }
  const [startToken, endToken] = GRADIENT_TOKENS_BY_INTENT[intent];
  return [theme.colors[startToken], theme.colors[endToken]];
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
  const s = sizeMap[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      feedback="none"
      sx={{ borderRadius: s.borderRadius }}
      style={() => ({
        userSelect: 'none',
        ...(flex !== undefined ? { flex } : {}),
      })}
    >
      {({ pressed }) => (
        <ButtonFace
          intent={intent}
          size={s}
          pressed={pressed && !isDisabled}
          isDisabled={isDisabled}
        >
          <ButtonContent
            title={title}
            size={s}
            intent={intent}
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

const PRESS_TRANSLATE_Y = 1;
const HOVER_OVERLAY_LIGHT = 'rgba(255, 255, 255, 0.10)';
const FACE_INNER_STROKE = 'rgba(255, 255, 255, 0.20)';

function elevationLevelFor(pressed: boolean, isDisabled: boolean): 0 | 1 | 2 {
  if (isDisabled) return 0;
  if (pressed) return 1;
  return 2;
}

function ButtonFace({
  intent,
  size,
  pressed,
  isDisabled,
  children,
}: {
  intent: ButtonIntent;
  size: SizeSpec;
  pressed: boolean;
  isDisabled: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const radius = size.borderRadius;
  const stops = resolveGradientStops(theme, intent, isDisabled);
  // Three-stop gradient holds the top color through the upper third so the
  // transition reads as gentle shading on a real surface rather than a
  // two-tone split.
  const faceColors: readonly [ColorValue, ColorValue, ColorValue] = [
    stops[0],
    stops[0],
    stops[1],
  ];
  const faceLocations = [0, 0.35, 1] as const;
  const liftStyle = theme.elevation(elevationLevelFor(pressed, isDisabled));
  return (
    <View
      style={{
        borderRadius: radius,
        transform: pressed ? [{ translateY: PRESS_TRANSLATE_Y }] : undefined,
        ...(liftStyle.boxShadow ? { boxShadow: liftStyle.boxShadow } : {}),
        ...(liftStyle.elevation !== undefined
          ? { elevation: liftStyle.elevation }
          : {}),
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
            borderWidth: isDisabled || intent === 'neutral' ? 0 : 1,
            borderColor: FACE_INNER_STROKE,
          },
          intent === 'neutral'
            ? { borderWidth: 1, borderColor: theme.colors.border }
            : undefined,
        ]}
      >
        {pressed || isDisabled ? null : (
          <ButtonHoverGloss radius={radius} intent={intent} />
        )}
        {children}
      </LinearGradient>
    </View>
  );
}

/**
 * A whisper-soft top gloss that fades to transparent. Helps the face read as
 * a slightly tilted surface without crossing into "arcade gloss" territory.
 * Skipped for neutral (we want it to read flat-ish) and for disabled / pressed.
 */
function ButtonHoverGloss({
  radius,
  intent,
}: {
  radius: number;
  intent: ButtonIntent;
}): ReactNode {
  if (intent === 'neutral') return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[HOVER_OVERLAY_LIGHT, 'rgba(255, 255, 255, 0)']}
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

function ButtonContent({
  title,
  size,
  intent,
  isDisabled,
  loading,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  size: SizeSpec;
  intent: ButtonIntent;
  isDisabled: boolean;
  loading: boolean;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  const theme = useTheme();
  const fg = buttonForegroundColor(theme, intent, isDisabled);
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
          ...(Platform.OS === 'web'
            ? { letterSpacing: 0.1 }
            : {}),
        }}
        label={title}
      />
      {endIcon !== undefined ? (
        <View style={iconBoxStyle}>{endIcon}</View>
      ) : null}
    </>
  );
}
