/**
 * `Button` -- themed pressable with three intents, three sizes, three variants.
 *
 * Flat, modern surface (Linear / shadcn / Radix lineage) -- no gradient,
 * no gloss. Solid fills paired with dedicated `on*` foreground tokens so
 * the label keeps high contrast in both schemes.
 *
 * `intent` chooses the color role (primary / danger / neutral); `variant`
 * chooses how much visual weight that color carries:
 *   - `solid` (default) -- saturated fill + `on*` label, looks like the
 *     primary action.
 *   - `outline` -- transparent bg + colored border + intent-colored label.
 *   - `ghost` -- transparent bg, no border, intent-colored label, gets a
 *     subtle interactive overlay on hover/press.
 *
 * Hover/press feedback is delegated to {@link Pressable}'s tint overlay,
 * so the same interaction language is consistent across every pressable
 * surface in the system.
 *
 * @example
 * ```tsx
 * <Button title="Save" intent="primary" onPress={save} />
 * <Button title="Delete" intent="danger" onPress={del} />
 * <Button title="Cancel" intent="neutral" variant="outline" onPress={cancel} />
 * <Button title="Skip" intent="neutral" variant="ghost" onPress={skip} />
 * ```
 */

import { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { Text } from '../text';

export type ButtonIntent = 'primary' | 'danger' | 'neutral';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';

export type ButtonProps = {
  title: ReactNode;
  onPress?: () => void;
  /** Color/role of the button. Defaults to `"primary"`. */
  intent?: ButtonIntent;
  /** Visual weight of the button. Defaults to `"solid"`. */
  variant?: ButtonVariant;
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

const sizeMap = {
  sm: {
    py: 1.5,
    px: 3,
    borderRadius: borderRadius.md,
    minHeight: 32,
    text: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
    iconGap: 1.5,
  },
  md: {
    py: 2.5,
    px: 4,
    borderRadius: borderRadius.md,
    minHeight: 40,
    text: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    iconGap: 2,
  },
  lg: {
    py: 3,
    px: 5,
    borderRadius: borderRadius.md,
    minHeight: 48,
    text: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
    iconGap: 2,
  },
} as const;

type SizeSpec = (typeof sizeMap)[ButtonSize];

type IntentTokens = {
  /** Background color for `variant="solid"`. */
  solidBg: string;
  /** Foreground (label/icon) on top of `solidBg`. */
  solidFg: string;
  /** Foreground for `variant="outline"` and `variant="ghost"`. */
  accent: string;
  /** Border color for `variant="outline"`. */
  outlineBorder: string;
};

function resolveIntentTokens(theme: Theme, intent: ButtonIntent): IntentTokens {
  const c = theme.colors;
  if (intent === 'primary') {
    return {
      solidBg: c.tint,
      solidFg: c.onPrimary,
      accent: c.tint,
      outlineBorder: c.tint,
    };
  }
  if (intent === 'danger') {
    return {
      solidBg: c.destructive,
      solidFg: c.onDestructive,
      accent: c.destructive,
      outlineBorder: c.destructive,
    };
  }
  return {
    solidBg: c.surface,
    solidFg: c.text,
    accent: c.text,
    outlineBorder: c.outline,
  };
}

type FaceStyle = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  foregroundColor: string;
  /** Whether to render the small elevation shadow under the face. */
  withElevation: boolean;
};

function resolveFaceStyle(
  theme: Theme,
  intent: ButtonIntent,
  variant: ButtonVariant,
  isDisabled: boolean
): FaceStyle {
  const c = theme.colors;
  if (isDisabled) {
    return {
      backgroundColor: variant === 'solid' ? c.disabled : 'transparent',
      borderColor: c.border,
      borderWidth: variant === 'solid' ? 0 : 1,
      foregroundColor: c.textSecondary,
      withElevation: false,
    };
  }
  const tokens = resolveIntentTokens(theme, intent);
  if (variant === 'outline') {
    return {
      backgroundColor: 'transparent',
      borderColor: tokens.outlineBorder,
      borderWidth: 1,
      foregroundColor: tokens.accent,
      withElevation: false,
    };
  }
  if (variant === 'ghost') {
    return {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      foregroundColor: tokens.accent,
      withElevation: false,
    };
  }
  // solid
  if (intent === 'neutral') {
    return {
      backgroundColor: tokens.solidBg,
      borderColor: c.outline,
      borderWidth: 1,
      foregroundColor: tokens.solidFg,
      withElevation: theme.colorScheme === 'light',
    };
  }
  return {
    backgroundColor: tokens.solidBg,
    borderColor: 'transparent',
    borderWidth: 0,
    foregroundColor: tokens.solidFg,
    withElevation: theme.colorScheme === 'light',
  };
}

/**
 * Foreground color (label, spinner, suggested icon) applied on top of the
 * button face. Exposed so consumers passing `startIcon` / `endIcon` can
 * tint their icons to match the label.
 */
export function buttonForegroundColor(
  theme: Theme,
  intent: ButtonIntent,
  isDisabled: boolean,
  variant: ButtonVariant = 'solid'
): string {
  return resolveFaceStyle(theme, intent, variant, isDisabled).foregroundColor;
}

export function Button({
  title,
  onPress,
  intent = 'primary',
  variant = 'solid',
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
  const face = resolveFaceStyle(theme, intent, variant, isDisabled);
  const shadow = face.withElevation ? theme.elevation(1) : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      sx={{ borderRadius: s.borderRadius }}
      style={() => ({
        userSelect: 'none',
        ...(flex !== undefined ? { flex } : {}),
        backgroundColor: face.backgroundColor,
        borderColor: face.borderColor,
        borderWidth: face.borderWidth,
        borderRadius: s.borderRadius,
        paddingHorizontal: s.px * 4,
        paddingVertical: s.py * 4,
        minHeight: s.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.iconGap * 4,
        ...(shadow?.boxShadow ? { boxShadow: shadow.boxShadow } : {}),
        ...(shadow?.elevation !== undefined
          ? { elevation: shadow.elevation }
          : {}),
      })}
    >
      <ButtonContent
        title={title}
        size={s}
        foregroundColor={face.foregroundColor}
        loading={loading}
        startIcon={startIcon}
        endIcon={endIcon}
      />
    </Pressable>
  );
}

function ButtonContent({
  title,
  size,
  foregroundColor,
  loading,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  size: SizeSpec;
  foregroundColor: string;
  loading: boolean;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  if (loading)
    return <Spinner color={foregroundColor} size={size.text.lineHeight} />;
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
          color: foregroundColor,
          fontSize: size.text.fontSize,
          lineHeight: size.text.lineHeight,
          fontWeight: size.text.fontWeight,
          includeFontPadding: false,
          textAlignVertical: 'center',
          ...(Platform.OS === 'web' ? { letterSpacing: 0.1 } : {}),
        }}
        label={title}
      />
      {endIcon !== undefined ? (
        <View style={iconBoxStyle}>{endIcon}</View>
      ) : null}
    </>
  );
}
