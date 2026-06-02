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
import {
  bestOnColor,
  contrastRatio,
  OnColorProvider,
  parseColor,
  useTheme,
  type Theme,
} from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { IconSymbol, type IconSymbolName } from '../symbol-icon';
import { Text } from '../text';

/** WCAG AA threshold for normal-weight text. */
const MIN_CONTRAST = 4.5;

/**
 * Keep the curated `on*` label color, but if a (possibly overridden) fill
 * would drop it below AA, swap to the best-contrast foreground for that fill.
 */
function ensureContrast(fg: string, bg: string): string {
  const fgRgb = parseColor(fg);
  const bgRgb = parseColor(bg);
  if (!fgRgb || !bgRgb) return fg;
  if (contrastRatio(fgRgb, bgRgb) >= MIN_CONTRAST) return fg;
  return bestOnColor(bg).fg;
}

export type ButtonIntent = 'primary' | 'danger' | 'neutral';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
/**
 * Mutation lifecycle the button reflects in place. `loading` shows a spinner,
 * `success` flips to a solid success face with a check, `error` to a solid
 * destructive face with an X that re-presses as a retry. See
 * {@link useMutationButton} for driving this from an async operation.
 */
export type ButtonFeedback = 'idle' | 'loading' | 'success' | 'error';

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
  /**
   * Mutation feedback state. When set it supersedes `loading` and drives the
   * face + content (loading spinner, success check, retryable error).
   */
  feedback?: ButtonFeedback;
  /** Label while `feedback === 'loading'`. Falls back to `title`. */
  loadingLabel?: ReactNode;
  /** Label while `feedback === 'success'`. Falls back to `title`. */
  successLabel?: ReactNode;
  /** Label while `feedback === 'error'`. Falls back to `title`. */
  errorLabel?: ReactNode;
  /** Press handler while `feedback === 'error'`. Falls back to `onPress`. */
  onRetry?: () => void;
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
      // `tintActive` (darker brand) keeps a white label AA-legible in both
      // schemes; `tint` stays for the outline/ghost accent on neutral fills.
      solidBg: c.tintActive,
      solidFg: c.onPrimary,
      accent: c.tint,
      outlineBorder: c.tint,
    };
  }
  if (intent === 'danger') {
    return {
      solidBg: c.destructiveActive,
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
      foregroundColor: ensureContrast(tokens.solidFg, tokens.solidBg),
      withElevation: theme.colorScheme === 'light',
    };
  }
  return {
    backgroundColor: tokens.solidBg,
    borderColor: 'transparent',
    borderWidth: 0,
    foregroundColor: ensureContrast(tokens.solidFg, tokens.solidBg),
    withElevation: theme.colorScheme === 'light',
  };
}

/**
 * Solid face for the success / error feedback phases. Returns `null` for the
 * idle / loading phases so the caller falls back to the intent-driven face.
 */
function resolveFeedbackFace(
  theme: Theme,
  feedback: ButtonFeedback
): FaceStyle | null {
  const c = theme.colors;
  const withElevation = theme.colorScheme === 'light';
  if (feedback === 'success') {
    return {
      backgroundColor: c.success,
      borderColor: 'transparent',
      borderWidth: 0,
      foregroundColor: ensureContrast(c.onSuccess, c.success),
      withElevation,
    };
  }
  if (feedback === 'error') {
    return {
      backgroundColor: c.destructiveActive,
      borderColor: 'transparent',
      borderWidth: 0,
      foregroundColor: ensureContrast(c.onDestructive, c.destructiveActive),
      withElevation,
    };
  }
  return null;
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

type ButtonRender = {
  phase: ButtonFeedback;
  face: FaceStyle;
  nonInteractive: boolean;
  handlePress: (() => void) | undefined;
};

function buttonPhase(props: ButtonProps): ButtonFeedback {
  if (props.feedback !== undefined) return props.feedback;
  return props.loading === true ? 'loading' : 'idle';
}

/** Collapse props + feedback phase into the face, press handler, and disabled flag. */
function resolveButtonRender(theme: Theme, props: ButtonProps): ButtonRender {
  const phase = buttonPhase(props);
  const nonInteractive =
    (props.disabled ?? false) || phase === 'loading' || phase === 'success';
  const face =
    resolveFeedbackFace(theme, phase) ??
    resolveFaceStyle(
      theme,
      props.intent ?? 'primary',
      props.variant ?? 'solid',
      nonInteractive
    );
  const handlePress =
    phase === 'error' ? (props.onRetry ?? props.onPress) : props.onPress;
  return { phase, face, nonInteractive, handlePress };
}

export function Button(props: ButtonProps) {
  const { size = 'md', flex } = props;
  const theme = useTheme();
  const s = sizeMap[size];
  const { phase, face, nonInteractive, handlePress } = resolveButtonRender(
    theme,
    props
  );
  const shadow = face.withElevation ? theme.elevation(1) : undefined;

  return (
    <Pressable
      onPress={handlePress}
      disabled={nonInteractive}
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
      <OnColorProvider
        value={{
          fg: face.foregroundColor,
          fgMuted: face.foregroundColor,
          icon: face.foregroundColor,
        }}
      >
        <ButtonContent
          props={props}
          phase={phase}
          size={s}
          foregroundColor={face.foregroundColor}
        />
      </OnColorProvider>
    </Pressable>
  );
}

/** Icon paired with each terminal feedback phase. */
const FEEDBACK_ICON = {
  success: 'check.circle.fill',
  error: 'xmark',
} as const satisfies Record<'success' | 'error', IconSymbolName>;

function ButtonContent({
  props,
  phase,
  size,
  foregroundColor,
}: {
  props: ButtonProps;
  phase: ButtonFeedback;
  size: SizeSpec;
  foregroundColor: string;
}) {
  if (phase === 'loading') {
    return (
      <ButtonStatusContent
        spinner
        size={size}
        foregroundColor={foregroundColor}
        label={props.loadingLabel}
      />
    );
  }
  if (phase === 'success' || phase === 'error') {
    const label = phase === 'success' ? props.successLabel : props.errorLabel;
    return (
      <ButtonStatusContent
        icon={FEEDBACK_ICON[phase]}
        size={size}
        foregroundColor={foregroundColor}
        label={label ?? props.title}
      />
    );
  }
  return (
    <ButtonIdleContent
      title={props.title}
      size={size}
      foregroundColor={foregroundColor}
      startIcon={props.startIcon}
      endIcon={props.endIcon}
    />
  );
}

function ButtonLabelText({
  label,
  size,
  foregroundColor,
}: {
  label: ReactNode;
  size: SizeSpec;
  foregroundColor: string;
}) {
  return (
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
      label={label}
    />
  );
}

/** Loading / success / error content: a leading indicator plus optional label. */
function ButtonStatusContent({
  spinner = false,
  icon,
  size,
  foregroundColor,
  label,
}: {
  spinner?: boolean;
  icon?: IconSymbolName;
  size: SizeSpec;
  foregroundColor: string;
  label: ReactNode;
}) {
  const indicator = spinner ? (
    <Spinner color={foregroundColor} size={size.text.lineHeight} />
  ) : (
    <IconSymbol
      name={icon ?? 'xmark'}
      size={size.text.lineHeight}
      color={foregroundColor}
    />
  );
  if (label === undefined || label === null) return indicator;
  return (
    <>
      {indicator}
      <ButtonLabelText
        label={label}
        size={size}
        foregroundColor={foregroundColor}
      />
    </>
  );
}

function ButtonIdleContent({
  title,
  size,
  foregroundColor,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  size: SizeSpec;
  foregroundColor: string;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
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
      <ButtonLabelText
        label={title}
        size={size}
        foregroundColor={foregroundColor}
      />
      {endIcon !== undefined ? (
        <View style={iconBoxStyle}>{endIcon}</View>
      ) : null}
    </>
  );
}
