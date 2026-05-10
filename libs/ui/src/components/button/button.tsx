/**
 * `Button` -- themed pressable button with three intents and three sizes.
 *
 * Renders a linear-gradient fill (via `expo-linear-gradient`) for `primary`,
 * `danger`, and `neutral` intents. `primary` and `danger` use white label
 * and icon color in both light and dark themes. Corners are modestly rounded
 * (rectangular, not pill). Sizes only adjust padding; label stays heading weight.
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
};

/** Compact padding; modest corner radius (rounded rectangle, not pill). */
const sizeMap = {
  sm: { py: 1 as number, px: 2 as number, borderRadius: borderRadius.sm },
  md: { py: 2 as number, px: 3 as number, borderRadius: borderRadius.sm },
  lg: { py: 2 as number, px: 4 as number, borderRadius: borderRadius.md },
};

const ON_GRADIENT_WHITE = '#ffffff';

function labelAndSpinnerColor(
  theme: Theme,
  intent: ButtonIntent,
  isDisabled: boolean
): string {
  if (isDisabled) {
    return theme.colors.textSecondary;
  }
  if (intent === 'primary' || intent === 'danger') {
    return ON_GRADIENT_WHITE;
  }
  return theme.colors.surface;
}

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

export function Button({
  title,
  onPress,
  intent = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
}: ButtonProps) {
  const theme = useTheme();
  const s = sizeMap[size];
  const isDisabled = disabled || loading;
  const stops = resolveGradientStops(theme, intent, isDisabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        { borderRadius: s.borderRadius, userSelect: 'none' },
        pressed && !isDisabled && { opacity: 0.85 },
      ]}
    >
      <LinearGradient
        colors={stops}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={theme.sx({
          py: s.py,
          px: s.px,
          borderRadius: s.borderRadius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        })}
      >
        <ButtonContent
          title={title}
          intent={intent}
          isDisabled={isDisabled}
          loading={loading}
          startIcon={startIcon}
          endIcon={endIcon}
        />
      </LinearGradient>
    </Pressable>
  );
}

function ButtonContent({
  title,
  intent,
  isDisabled,
  loading,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  intent: ButtonIntent;
  isDisabled: boolean;
  loading: boolean;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  const theme = useTheme();
  const fg = labelAndSpinnerColor(theme, intent, isDisabled);
  if (loading) return <Spinner size="small" color={fg} />;
  return (
    <>
      {startIcon !== undefined ? <View>{startIcon}</View> : null}
      <Text variant="heading" style={{ color: fg }} label={title} />
      {endIcon !== undefined ? <View>{endIcon}</View> : null}
    </>
  );
}
