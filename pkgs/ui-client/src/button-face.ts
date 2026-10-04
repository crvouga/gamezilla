/**
 * Pure color/shape resolution shared by `Button` and `FloatingActionButton`.
 *
 * `intent` chooses the color role; `variant` chooses how much weight the
 * color carries; the mutation `feedback` phase overrides both while a
 * success / error face is showing. Colors are theme token references
 * (`var(--ui-color-*)`), so faces never recompute on a scheme switch.
 */

import type { ColorTokens } from '@pkgs/ui-shared/colors-types';
import type { IconComponent } from './create-icon';
import { CircleCheckIcon, XIcon } from './icons';

export type ButtonIntent = 'primary' | 'danger' | 'success' | 'neutral';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonFeedback = 'idle' | 'loading' | 'success' | 'error';

export type ButtonFace = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  foregroundColor: string;
};

export type ButtonRenderInput = {
  intent?: ButtonIntent | undefined;
  variant?: ButtonVariant | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  feedback?: ButtonFeedback | undefined;
  onClick?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
};

export type ButtonRender = {
  phase: ButtonFeedback;
  face: ButtonFace;
  nonInteractive: boolean;
  handleClick: (() => void) | undefined;
};

export const MUTATION_FEEDBACK_ICONS = {
  success: CircleCheckIcon,
  error: XIcon,
} as const satisfies Record<'success' | 'error', IconComponent>;

type IntentTokens = {
  solidBg: string;
  solidFg: string;
  accent: string;
  outlineBorder: string;
};

function resolveIntentTokens(
  c: ColorTokens,
  intent: ButtonIntent
): IntentTokens {
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

function solidFace(bg: string, fg: string): ButtonFace {
  return {
    backgroundColor: bg,
    borderColor: 'transparent',
    borderWidth: 0,
    foregroundColor: fg,
  };
}

export function resolveFaceStyle(
  c: ColorTokens,
  intent: ButtonIntent,
  variant: ButtonVariant,
  isDisabled: boolean
): ButtonFace {
  if (isDisabled) {
    return {
      backgroundColor: variant === 'solid' ? c.disabled : 'transparent',
      borderColor: c.border,
      borderWidth: variant === 'solid' ? 0 : 1,
      foregroundColor: c.textSecondary,
    };
  }
  const tokens = resolveIntentTokens(c, intent);
  if (variant === 'outline') {
    return {
      backgroundColor: 'transparent',
      borderColor: tokens.outlineBorder,
      borderWidth: 1,
      foregroundColor: tokens.accent,
    };
  }
  if (variant === 'ghost') {
    return {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      foregroundColor: tokens.accent,
    };
  }
  return solidFace(tokens.solidBg, tokens.solidFg);
}

export function resolveFeedbackFace(
  c: ColorTokens,
  feedback: ButtonFeedback
): ButtonFace | null {
  if (feedback === 'success') return solidFace(c.success, c.onSuccess);
  if (feedback === 'error') {
    return solidFace(c.destructiveActive, c.onDestructive);
  }
  return null;
}

export function buttonPhase(input: ButtonRenderInput): ButtonFeedback {
  if (input.feedback !== undefined) return input.feedback;
  return input.loading === true ? 'loading' : 'idle';
}

/** CSS `data-face` value. Paint lives in `skin.css`, not inline styles. */
export type ButtonFaceName =
  | 'primary'
  | 'danger'
  | 'success'
  | 'neutral'
  | 'primary-outline'
  | 'danger-outline'
  | 'success-outline'
  | 'neutral-outline'
  | 'primary-ghost'
  | 'danger-ghost'
  | 'success-ghost'
  | 'neutral-ghost'
  | 'disabled'
  | 'disabled-outline'
  | 'disabled-ghost'
  | 'feedback-success'
  | 'feedback-error';

const SOLID_FACE = {
  primary: 'primary',
  danger: 'danger',
  success: 'success',
  neutral: 'neutral',
} as const satisfies Record<ButtonIntent, ButtonFaceName>;

const OUTLINE_FACE = {
  primary: 'primary-outline',
  danger: 'danger-outline',
  success: 'success-outline',
  neutral: 'neutral-outline',
} as const satisfies Record<ButtonIntent, ButtonFaceName>;

const GHOST_FACE = {
  primary: 'primary-ghost',
  danger: 'danger-ghost',
  success: 'success-ghost',
  neutral: 'neutral-ghost',
} as const satisfies Record<ButtonIntent, ButtonFaceName>;

export function buttonFaceName(input: ButtonRenderInput): ButtonFaceName {
  const phase = buttonPhase(input);
  if (phase === 'success') return 'feedback-success';
  if (phase === 'error') return 'feedback-error';
  const variant = input.variant ?? 'solid';
  const intent = input.intent ?? 'primary';
  const disabled = (input.disabled ?? false) || phase === 'loading';
  if (disabled && variant === 'outline') return 'disabled-outline';
  if (disabled && variant === 'ghost') return 'disabled-ghost';
  if (disabled) return 'disabled';
  if (variant === 'outline') return OUTLINE_FACE[intent];
  if (variant === 'ghost') return GHOST_FACE[intent];
  return SOLID_FACE[intent];
}

export type ButtonInteraction = {
  phase: ButtonFeedback;
  face: ButtonFaceName;
  nonInteractive: boolean;
  handleClick: (() => void) | undefined;
};

/** Phase, hit testing, and the CSS face. No color lookup. */
export function buttonInteraction(input: ButtonRenderInput): ButtonInteraction {
  const phase = buttonPhase(input);
  const nonInteractive =
    (input.disabled ?? false) || phase === 'loading' || phase === 'success';
  const handleClick =
    phase === 'error' ? (input.onRetry ?? input.onClick) : input.onClick;
  return {
    phase,
    face: buttonFaceName(input),
    nonInteractive,
    handleClick,
  };
}

export function resolveButtonRender(
  c: ColorTokens,
  input: ButtonRenderInput
): ButtonRender {
  const phase = buttonPhase(input);
  const nonInteractive =
    (input.disabled ?? false) || phase === 'loading' || phase === 'success';
  const face =
    resolveFeedbackFace(c, phase) ??
    resolveFaceStyle(
      c,
      input.intent ?? 'primary',
      input.variant ?? 'solid',
      nonInteractive
    );
  const handleClick =
    phase === 'error' ? (input.onRetry ?? input.onClick) : input.onClick;
  return { phase, face, nonInteractive, handleClick };
}

/** Foreground (label / icon) color a `Button` would use for these settings. */
export function buttonForegroundColor(
  colors: ColorTokens,
  intent: ButtonIntent,
  isDisabled: boolean,
  variant: ButtonVariant = 'solid'
): string {
  return resolveFaceStyle(colors, intent, variant, isDisabled).foregroundColor;
}
