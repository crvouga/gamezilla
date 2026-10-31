/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ButtonFeedback, ButtonIntent } from '../button-face';
import { buttonInteraction, MUTATION_FEEDBACK_ICONS } from '../button-face';
import type { IconComponent } from '../create-icon/index';
import { PlusIcon } from '../icons';
import { Spinner } from '../spinner/index';

const FAB_ICON_SIZE = 24;

export type FloatingActionButtonProps = {
  onClick?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  feedback?: ButtonFeedback | undefined;
  'aria-label': string;
  icon?: IconComponent | undefined;
  intent?: ButtonIntent | undefined;
  /** When set, renders an extended pill FAB with icon + label. */
  label?: JSX.Element | undefined;
  loadingLabel?: JSX.Element | undefined;
  successLabel?: JSX.Element | undefined;
  errorLabel?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

type FabLabels = Pick<
  FloatingActionButtonProps,
  'label' | 'loadingLabel' | 'successLabel' | 'errorLabel'
>;

const PHASE_LABEL: Record<
  ButtonFeedback,
  (labels: FabLabels) => JSX.Element | undefined
> = {
  idle: (labels) => labels.label,
  loading: (labels) => labels.loadingLabel ?? labels.label,
  success: (labels) => labels.successLabel ?? labels.label,
  error: (labels) => labels.errorLabel ?? labels.label,
};

export function fabLabelForPhase(
  phase: ButtonFeedback,
  labels: FabLabels
): JSX.Element | undefined {
  return PHASE_LABEL[phase](labels);
}

function FabLabelText(props: { label: JSX.Element }): JSX.Element {
  return <p class="text whitespace-nowrap">{props.label}</p>;
}

function FabContent(props: {
  phase: ButtonFeedback;
  icon: IconComponent;
  labels: FabLabels;
}): JSX.Element {
  const text = (): JSX.Element | undefined =>
    fabLabelForPhase(props.phase, props.labels);
  const showText = (): boolean =>
    props.labels.label !== undefined && text() !== undefined;
  return (
    <>
      <Switch>
        <Match when={props.phase === 'loading'}>
          <Spinner decorative color="current" />
        </Match>
        <Match when={props.phase === 'success' || props.phase === 'error'}>
          <Dynamic
            component={
              props.phase === 'success'
                ? MUTATION_FEEDBACK_ICONS.success
                : MUTATION_FEEDBACK_ICONS.error
            }
            size={FAB_ICON_SIZE}
          />
        </Match>
        <Match when={props.phase === 'idle'}>
          <Dynamic component={props.icon} size={FAB_ICON_SIZE} />
        </Match>
      </Switch>
      <Show when={showText()}>
        <FabLabelText label={text()} />
      </Show>
    </>
  );
}

const FAB_CLASS =
  'items-center justify-center flex-row overflow-hidden rounded-full';

/**
 * `FloatingActionButton` -- round (or extended pill) primary action.
 *
 * A 52px disc (`--ui-control-size-lg`) or, with `label`, an extended pill:
 * the primary fill with an on-primary 24px icon, and the one soft
 * `shadow-float` because it floats above content (`skin.css` `.fab`).
 *
 * Shares the mutation face machine with `Button`: `loading` / `feedback`
 * swap the icon for a spinner, check, or retry glyph (`aria-busy` while
 * loading). Hover changes the tint, press scales it slightly, keyboard focus
 * draws the ring, disabled greys it. Pair with `useMutationButton().fabProps`.
 */
export function FloatingActionButton(
  props: FloatingActionButtonProps
): JSX.Element {
  const extended = (): boolean => props.label !== undefined;
  const state = createMemo(() =>
    buttonInteraction({
      intent: props.intent ?? 'primary',
      variant: 'solid',
      disabled: props.disabled,
      loading: props.loading,
      feedback: props.feedback,
      onClick: props.onClick,
      onRetry: props.onRetry,
    })
  );
  return (
    <button
      class={`clickable clickableTint fab ${FAB_CLASS}`}
      {...dataAttrs({
        component: 'FloatingActionButton',
        intent: props.intent ?? 'primary',
        phase: state().phase,
        face: state().face,
        extended: extended() ? 'true' : 'false',
        ...props.dataSet,
      })}
      type="button"
      onClick={() => state().handleClick?.()}
      disabled={state().nonInteractive}
      aria-busy={state().phase === 'loading' ? true : undefined}
      aria-label={props['aria-label']}
    >
      <div class="box relative z-1 flex-row items-center gap-2">
        <FabContent
          phase={state().phase}
          icon={props.icon ?? PlusIcon}
          labels={{
            get label() {
              return props.label;
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
        />
      </div>
    </button>
  );
}
