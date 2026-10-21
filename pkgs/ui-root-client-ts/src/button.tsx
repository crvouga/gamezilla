/** @jsxImportSource solid-js */
/**
 * `Button` -- themed `<button>` with four intents, three sizes, three variants.
 *
 * `intent` chooses the color role (primary / danger / success / neutral);
 * `variant` chooses how much visual weight that color carries:
 *   - `solid` (default) -- filled + `on*` label, looks like the primary action.
 *   - `outline` -- transparent bg + colored border + intent-colored label.
 *   - `ghost` -- transparent bg, no border, intent-colored label.
 *
 * `loading` / `feedback` drive the inline mutation faces (spinner, check,
 * retry) -- pair with `useMutationButton`. Hover/press feedback is delegated
 * to {@link Clickable}'s tint overlay.
 *
 * @example
 * ```tsx
 * <Button title="Save" intent="primary" onClick={save} />
 * <Button title="Delete" intent="danger" onClick={del} />
 * <Button title="Cancel" intent="neutral" variant="outline" onClick={cancel} />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX } from 'solid-js';
import type {
  ButtonFeedback,
  ButtonIntent,
  ButtonVariant,
} from './button-face';
import { buttonInteraction } from './button-face';
import type { ButtonSize, ButtonSizeSpec } from './button-parts';
import { BUTTON_SIZES, ButtonContent } from './button-parts';
import type { IconComponent } from './create-icon';

export type ButtonProps = {
  title: JSX.Element;
  onClick?: (() => void) | undefined;
  intent?: ButtonIntent | undefined;
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  /** Mutation phase; overrides `loading`. See `useMutationButton`. */
  feedback?: ButtonFeedback | undefined;
  loadingLabel?: JSX.Element | undefined;
  successLabel?: JSX.Element | undefined;
  errorLabel?: JSX.Element | undefined;
  /** Click handler while `feedback === 'error'`. Falls back to `onClick`. */
  onRetry?: (() => void) | undefined;
  /** Leading icon, sized/weighted by `size`. */
  icon?: IconComponent | undefined;
  /** Arbitrary leading node (caller-sized). */
  startIcon?: JSX.Element | undefined;
  /** Arbitrary trailing node (caller-sized). */
  endIcon?: JSX.Element | undefined;
  /** Flex weight inside a row. */
  flex?: number | undefined;
  /** Stretch to the container width. */
  fullWidth?: boolean | undefined;
  /** Form semantics. Defaults to `button`. */
  type?: 'button' | 'submit' | 'reset' | undefined;
  /**
   * Submitted with the form as `name=value` when this button submits it —
   * how a form with several submit buttons tells them apart (and how the
   * decision survives without JavaScript).
   */
  name?: string | undefined;
  value?: string | undefined;
  'aria-label'?: string | undefined;
  /** A toggle: whether it is on. Colour never carries that alone. */
  'aria-pressed'?: boolean | undefined;
  /** The one of a set that is chosen now (the move being looked at). */
  'aria-current'?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function buttonClass(args: {
  flex: number | undefined;
  fullWidth: boolean;
}): string {
  return [
    'flex-row items-center justify-center overflow-hidden select-none',
    args.fullWidth && 'self-stretch w-full',
    args.flex === 1 && 'flex-1',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps): JSX.Element {
  const spec = (): ButtonSizeSpec => BUTTON_SIZES[props.size ?? 'md'];
  const state = createMemo(() =>
    buttonInteraction({
      intent: props.intent,
      variant: props.variant,
      disabled: props.disabled,
      loading: props.loading,
      feedback: props.feedback,
      onClick: props.onClick,
      onRetry: props.onRetry,
    })
  );
  const flexStyle = (): JSX.CSSProperties | undefined =>
    props.flex !== undefined && props.flex !== 1
      ? { flex: String(props.flex) }
      : undefined;
  return (
    <button
      class={`clickable clickableTint btn ${buttonClass({
        flex: props.flex,
        fullWidth: props.fullWidth === true,
      })}`}
      {...dataAttrs({
        component: 'Button',
        intent: props.intent ?? 'primary',
        variant: props.variant ?? 'solid',
        size: props.size ?? 'md',
        phase: state().phase,
        face: state().face,
        ...props.dataSet,
      })}
      type={props.type ?? 'button'}
      name={props.name}
      value={props.value}
      onClick={() => state().handleClick?.()}
      disabled={state().nonInteractive}
      aria-busy={state().phase === 'loading' ? true : undefined}
      aria-label={props['aria-label']}
      aria-pressed={props['aria-pressed']}
      aria-current={props['aria-current']}
      style={flexStyle()}
    >
      <ButtonContent
        labels={{
          get title() {
            return props.title;
          },
          get loadingLabel() {
            return props.loadingLabel;
          },
          get successLabel() {
            return props.successLabel;
          },
          get errorLabel() {
            return props.errorLabel;
          },
        }}
        phase={state().phase}
        size={spec()}
        icon={props.icon}
        startIcon={props.startIcon}
        endIcon={props.endIcon}
      />
    </button>
  );
}
