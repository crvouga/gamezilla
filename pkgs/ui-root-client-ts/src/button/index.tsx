/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX } from 'solid-js';
import type {
  ButtonFeedback,
  ButtonIntent,
  ButtonVariant,
} from '../button-face';
import { buttonInteraction } from '../button-face';
import type { ButtonSize, ButtonSizeSpec } from '../button-parts/index';
import { BUTTON_SIZES, ButtonContent } from '../button-parts/index';
import type { IconComponent } from '../create-icon/index';

export type ButtonProps = {
  /** Visible action label; prefer a verb that describes the outcome. */
  title: JSX.Element;
  /** Runs the action. Use a Link for navigation to another route. */
  onClick?: (() => void) | undefined;
  /** Primary action, neutral alternative, or destructive action. */
  intent?: ButtonIntent | undefined;
  /** Solid emphasis, outlined alternative, or quiet ghost treatment. */
  variant?: ButtonVariant | undefined;
  /** Visual size; small buttons retain a 44px hit target. */
  size?: ButtonSize | undefined;
  /** Prevent activation when the action is unavailable. */
  disabled?: boolean | undefined;
  /** Show progress and prevent duplicate activation while work is pending. */
  loading?: boolean | undefined;
  /** Mutation phase; overrides `loading`. See `useMutationButton`. */
  feedback?: ButtonFeedback | undefined;
  /** Action-specific progress text, such as Saving. */
  loadingLabel?: JSX.Element | undefined;
  /** Confirm the completed outcome inline. */
  successLabel?: JSX.Element | undefined;
  /** Explain a failed action alongside its retry affordance. */
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
    // `hitTarget` grows a short (`sm`) pill to 44px; it needs the button
    // unclipped, so the label row clips its own overflow instead.
    'hitTarget flex-row items-center justify-center select-none',
    args.fullWidth && 'self-stretch w-full',
    args.flex === 1 && 'flex-1',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Run an action in the current view, such as saving a form or confirming a
 * choice. Use Link for navigation to another route.
 *
 * `Button` -- a themed pill `<button>`: three intents, three sizes, three
 * variants. The design brief's four buttons are:
 *
 * | Brief | Props | Look |
 * | --- | --- | --- |
 * | Primary | `intent="primary"` (default) | `tint-active` fill, `on-primary` label |
 * | Secondary | `intent="neutral"` (solid or `variant="outline"`) | transparent, 1px `outline` border, ink label |
 * | Ghost | `variant="ghost"` | no border, no fill at rest |
 * | Danger | `intent="danger" variant="outline"` | destructive label and border |
 * | Danger, confirming | `intent="danger"` (solid) | `destructive-active` fill, `on-destructive` label |
 *
 * Hover tints, press tints and settles to 0.97 (150ms, off under reduced
 * motion), keyboard focus draws the 2px `focus-ring` 2px outside the pill.
 * `disabled` greys the face; `loading` / `feedback` drive the inline
 * mutation faces (spinner, check, retry) -- pair with `useMutationButton`.
 * A `size="sm"` button is 32px tall but keeps a 44px hit area.
 *
 * @summary Run an action in the current view
 *
 * @example
 * ```tsx
 * <Button title="Save" onClick={save} />
 * <Button title="Cancel" intent="neutral" onClick={cancel} />
 * <Button title="Delete" intent="danger" variant="outline" icon={Trash2Icon} onClick={del} />
 * ```
 */
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
      <span class="box shrink min-w-0 flex-row items-center justify-center overflow-hidden">
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
      </span>
    </button>
  );
}
