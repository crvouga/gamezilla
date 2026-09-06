import {
  bestOnColor,
  contrastRatio,
  parseColor,
  type Theme,
} from '../../theme';
import type { IconComponent } from '../icons';
import { CircleCheckIcon, XIcon } from '../icons';
import { deriveSolidButtonSurface } from './derive-solid-button-surface';

const MIN_CONTRAST = 4.5;

export type ButtonIntent = 'primary' | 'danger' | 'success' | 'neutral';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonFeedback = 'idle' | 'loading' | 'success' | 'error';

export type MutationPressableFace = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  foregroundColor: string;
  withElevation: boolean;
  /** Chess.com-style vertical fill; omit for flat faces. */
  gradient?: { top: string; bottom: string };
  /** Bevel + drop shadow stack; replaces generic elevation when set. */
  surfaceShadow?: string;
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
  success: CircleCheckIcon,
  error: XIcon,
} as const satisfies Record<'success' | 'error', IconComponent>;

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
  if (intent === 'success') {
    return {
      solidBg: c.success,
      solidFg: c.onSuccess,
      accent: c.success,
      outlineBorder: c.success,
    };
  }
  return {
    solidBg: c.surface,
    solidFg: c.text,
    accent: c.text,
    outlineBorder: c.outline,
  };
}

function withSolidSurface(
  base: Omit<MutationPressableFace, 'gradient' | 'surfaceShadow'>,
  sourceCss: string,
  kind: 'accent' | 'neutral'
): MutationPressableFace {
  const surface = deriveSolidButtonSurface(sourceCss, kind);
  return {
    ...base,
    backgroundColor: surface.backgroundColor,
    surfaceShadow: surface.boxShadow,
    withElevation: false,
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
    return withSolidSurface(
      {
        backgroundColor: tokens.solidBg,
        borderColor: 'transparent',
        borderWidth: 0,
        foregroundColor: ensureContrast(tokens.solidFg, tokens.solidBg),
        withElevation: false,
      },
      tokens.solidBg,
      'neutral'
    );
  }
  return withSolidSurface(
    {
      backgroundColor: tokens.solidBg,
      borderColor: 'transparent',
      borderWidth: 0,
      foregroundColor: ensureContrast(tokens.solidFg, tokens.solidBg),
      withElevation: false,
    },
    tokens.solidBg,
    'accent'
  );
}

export function resolveFeedbackFace(
  theme: Theme,
  feedback: ButtonFeedback
): MutationPressableFace | null {
  const c = theme.colors;
  if (feedback === 'success') {
    return withSolidSurface(
      {
        backgroundColor: c.success,
        borderColor: 'transparent',
        borderWidth: 0,
        foregroundColor: ensureContrast(c.onSuccess, c.success),
        withElevation: false,
      },
      c.success,
      'accent'
    );
  }
  if (feedback === 'error') {
    return withSolidSurface(
      {
        backgroundColor: c.destructiveActive,
        borderColor: 'transparent',
        borderWidth: 0,
        foregroundColor: ensureContrast(c.onDestructive, c.destructiveActive),
        withElevation: false,
      },
      c.destructiveActive,
      'accent'
    );
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
