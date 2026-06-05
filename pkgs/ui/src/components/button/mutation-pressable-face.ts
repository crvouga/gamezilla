import {
  bestOnColor,
  contrastRatio,
  parseColor,
  type Theme,
} from '../../theme';
import type { IconSymbolName } from '../symbol-icon';

const MIN_CONTRAST = 4.5;

export type ButtonIntent = 'primary' | 'danger' | 'neutral';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonFeedback = 'idle' | 'loading' | 'success' | 'error';

export type MutationPressableFace = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  foregroundColor: string;
  withElevation: boolean;
};

export type MutationPressableInput = {
  intent?: ButtonIntent;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  feedback?: ButtonFeedback;
  onPress?: () => void;
  onRetry?: () => void;
};

export type MutationPressableRender = {
  phase: ButtonFeedback;
  face: MutationPressableFace;
  nonInteractive: boolean;
  handlePress: (() => void) | undefined;
};

export const MUTATION_FEEDBACK_ICONS = {
  success: 'check.circle.fill',
  error: 'xmark',
} as const satisfies Record<'success' | 'error', IconSymbolName>;

function ensureContrast(fg: string, bg: string): string {
  const fgRgb = parseColor(fg);
  const bgRgb = parseColor(bg);
  if (!fgRgb || !bgRgb) return fg;
  if (contrastRatio(fgRgb, bgRgb) >= MIN_CONTRAST) return fg;
  return bestOnColor(bg).fg;
}

type IntentTokens = {
  solidBg: string;
  solidFg: string;
  accent: string;
  outlineBorder: string;
};

function resolveIntentTokens(theme: Theme, intent: ButtonIntent): IntentTokens {
  const c = theme.colors;
  if (intent === 'primary') {
    return {
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

export function resolveFaceStyle(
  theme: Theme,
  intent: ButtonIntent,
  variant: ButtonVariant,
  isDisabled: boolean
): MutationPressableFace {
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

export function resolveFeedbackFace(
  theme: Theme,
  feedback: ButtonFeedback
): MutationPressableFace | null {
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

export function mutationPressablePhase(
  input: MutationPressableInput
): ButtonFeedback {
  if (input.feedback !== undefined) return input.feedback;
  return input.loading === true ? 'loading' : 'idle';
}

export function resolveMutationPressableRender(
  theme: Theme,
  input: MutationPressableInput
): MutationPressableRender {
  const phase = mutationPressablePhase(input);
  const nonInteractive =
    (input.disabled ?? false) || phase === 'loading' || phase === 'success';
  const face =
    resolveFeedbackFace(theme, phase) ??
    resolveFaceStyle(
      theme,
      input.intent ?? 'primary',
      input.variant ?? 'solid',
      nonInteractive
    );
  const handlePress =
    phase === 'error' ? (input.onRetry ?? input.onPress) : input.onPress;
  return { phase, face, nonInteractive, handlePress };
}

export function mutationPressableForegroundColor(
  theme: Theme,
  intent: ButtonIntent,
  isDisabled: boolean,
  variant: ButtonVariant = 'solid'
): string {
  return resolveFaceStyle(theme, intent, variant, isDisabled).foregroundColor;
}
