/** @jsxImportSource solid-js */
/**
 * `FloatingActionButton` -- round (or extended pill) primary action.
 *
 * Shares the mutation face machine with `Button`: `loading` / `feedback`
 * swap the icon for a spinner, check, or retry glyph. Pass `label` for the
 * extended pill variant; pair with `useMutationButton().fabProps`.
 */

import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { spacingScale } from '@pkgs/ui-shared/scale';
import type { ButtonFeedback, ButtonIntent } from './button-face';
import { buttonInteraction, MUTATION_FEEDBACK_ICONS } from './button-face';
import type { IconComponent } from './create-icon';
import { PlusIcon } from './icons';
import { Spinner } from './spinner';

export const FAB_SIZE = 56;
const FAB_ICON_SIZE = 24;
/** Spacing-scale steps (1 = 4px): icon/label gap 8px. */
const FAB_CONTENT_GAP = 2;

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

export function fabLabelForPhase(
  phase: ButtonFeedback,
  labels: FabLabels
): JSX.Element | undefined {
  switch (phase) {
    case 'loading':
      return labels.loadingLabel ?? labels.label;
    case 'success':
      return labels.successLabel ?? labels.label;
    case 'error':
      return labels.errorLabel ?? labels.label;
    default:
      return labels.label;
  }
}

function FabLabelText(props: { label: JSX.Element }): JSX.Element {
  return (
    <p class="text textBodyBold text-action font-semibold whitespace-nowrap">
      {props.label}
    </p>
  );
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
          <Spinner decorative color="currentColor" size={FAB_ICON_SIZE} />
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

function fabContainerClass(extended: boolean): string {
  return [
    'items-center justify-center flex-row overflow-hidden rounded-full',
    !extended && 'w-14',
  ]
    .filter(Boolean)
    .join(' ');
}

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
      class={`clickable clickableTint fab ${fabContainerClass(extended())}`}
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
      style={{
        height: `${FAB_SIZE}px`,
        'min-height': `${FAB_SIZE}px`,
      }}
    >
      <div
        class="box relative z-1 flex-row items-center"
        style={{ gap: `${spacingScale(FAB_CONTENT_GAP)}px` }}
      >
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
