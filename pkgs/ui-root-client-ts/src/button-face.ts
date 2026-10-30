/**
 * Pure face resolution shared by `Button` and `FloatingActionButton`.
 *
 * `intent` chooses the color role; `variant` chooses how much weight the
 * color carries; the mutation `feedback` phase overrides both while a
 * success / error face is showing. The result is a `data-face` name: every
 * color, border, hover / press tint and disabled tone for it lives in
 * `skin.css`, so a face never recomputes on a scheme switch.
 *
 * The four buttons of the design brief, as `intent` × `variant`:
 *
 * - **Primary** (`primary` solid, the default): the one saturated fill at
 *   rest (`tint-active` + `on-primary`).
 * - **Secondary** (`neutral` solid or outline): transparent, a 1px `outline`
 *   (line-strong) border, ink label. Both variants paint the same face; a
 *   neutral fill would be a second saturated-looking plate.
 * - **Ghost** (`ghost`): no border and no fill at rest; the intent colors
 *   the label (`neutral` ink, `primary` the `tint` blue).
 * - **Danger** (`danger`): `outline` is destructive text and border;
 *   `solid` is the `destructive-active` fill with a white label, for the
 *   action that confirms a destruction. Always with a word or an icon.
 *
 * Every face is a pill (`--ui-radius-full`). Success is never a resting
 * face: green appears only as the `feedback-success` phase.
 */

import type { IconComponent } from './create-icon/index';
import { CircleCheckIcon, XIcon } from './icons';

export type ButtonIntent = 'primary' | 'danger' | 'neutral';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonFeedback = 'idle' | 'loading' | 'success' | 'error';

export type ButtonRenderInput = {
  intent?: ButtonIntent | undefined;
  variant?: ButtonVariant | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  feedback?: ButtonFeedback | undefined;
  onClick?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
};

export const MUTATION_FEEDBACK_ICONS = {
  success: CircleCheckIcon,
  error: XIcon,
} as const satisfies Record<'success' | 'error', IconComponent>;

export function buttonPhase(input: ButtonRenderInput): ButtonFeedback {
  if (input.feedback !== undefined) return input.feedback;
  return input.loading === true ? 'loading' : 'idle';
}

/** CSS `data-face` value. Paint lives in `skin.css`, not inline styles. */
export type ButtonFaceName =
  | 'primary'
  | 'danger'
  | 'neutral'
  | 'primary-outline'
  | 'danger-outline'
  | 'neutral-outline'
  | 'primary-ghost'
  | 'danger-ghost'
  | 'neutral-ghost'
  | 'disabled'
  | 'disabled-outline'
  | 'disabled-ghost'
  | 'feedback-success'
  | 'feedback-error';

const SOLID_FACE = {
  primary: 'primary',
  danger: 'danger',
  neutral: 'neutral',
} as const satisfies Record<ButtonIntent, ButtonFaceName>;

const OUTLINE_FACE = {
  primary: 'primary-outline',
  danger: 'danger-outline',
  neutral: 'neutral-outline',
} as const satisfies Record<ButtonIntent, ButtonFaceName>;

const GHOST_FACE = {
  primary: 'primary-ghost',
  danger: 'danger-ghost',
  neutral: 'neutral-ghost',
} as const satisfies Record<ButtonIntent, ButtonFaceName>;

export function buttonFaceName(input: ButtonRenderInput): ButtonFaceName {
  const phase = buttonPhase(input);
  if (phase === 'success') return 'feedback-success';
  if (phase === 'error') return 'feedback-error';
  const variant = input.variant ?? 'solid';
  const intent = input.intent ?? 'primary';
  // Loading keeps its intent face (the spinner sits on the same blue); the
  // control is still inert and `aria-busy`. Only `disabled` greys it out.
  const disabled = input.disabled ?? false;
  // Secondary (`neutral` solid) is drawn as an outline, so it disables as one.
  const outlined =
    variant === 'outline' || (variant === 'solid' && intent === 'neutral');
  if (disabled && outlined) return 'disabled-outline';
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
