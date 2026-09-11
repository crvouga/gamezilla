/** @jsxImportSource solid-js */
/**
 * `FloatingActionButton` -- round (or extended pill) primary action.
 *
 * Shares the mutation face machine with `Button`: `loading` / `feedback`
 * swap the icon for a spinner, check, or retry glyph. Pass `label` for the
 * extended pill variant; pair with `useMutationButton().fabProps`.
 */

import { type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import {
  OnColorProvider,
  type OnColorSet,
  spacingScale,
  useThemeTokens,
} from '../../theme';
import {
  type ButtonFace,
  type ButtonFeedback,
  type ButtonIntent,
  MUTATION_FEEDBACK_ICONS,
  resolveButtonRender,
} from '../button';
import { type IconComponent, PlusIcon } from '../icons';
import { Spinner } from '../spinner';

export const FAB_SIZE = 56;
const FAB_ICON_SIZE = 24;
const FAB_HORIZONTAL_PADDING = 16;
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

function FabLabelText(props: {
  label: JSX.Element;
  foregroundColor: string;
}): JSX.Element {
  return (
    <p
      class="text textBodyBold text-[15px] leading-[20px] font-semibold whitespace-nowrap"
      style={{ color: props.foregroundColor }}
    >
      {props.label}
    </p>
  );
}

function FabContent(props: {
  phase: ButtonFeedback;
  icon: IconComponent;
  foregroundColor: string;
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
          <Spinner
            decorative
            color={props.foregroundColor}
            size={FAB_ICON_SIZE}
          />
        </Match>
        <Match when={props.phase === 'success' || props.phase === 'error'}>
          <Dynamic
            component={
              props.phase === 'success'
                ? MUTATION_FEEDBACK_ICONS.success
                : MUTATION_FEEDBACK_ICONS.error
            }
            size={FAB_ICON_SIZE}
            color={props.foregroundColor}
          />
        </Match>
        <Match when={props.phase === 'idle'}>
          <Dynamic
            component={props.icon}
            size={FAB_ICON_SIZE}
            color={props.foregroundColor}
          />
        </Match>
      </Switch>
      <Show when={showText()}>
        <FabLabelText label={text()} foregroundColor={props.foregroundColor} />
      </Show>
    </>
  );
}

function fabContainerClass(extended: boolean): string {
  return [
    'items-center justify-center flex-row overflow-hidden rounded-[9999px]',
    !extended && 'w-[56px]',
  ]
    .filter(Boolean)
    .join(' ');
}

function fabContainerStyle(
  extended: boolean,
  face: ButtonFace
): JSX.CSSProperties {
  return {
    height: `${FAB_SIZE}px`,
    'min-height': `${FAB_SIZE}px`,
    'background-color': face.backgroundColor,
    'border-color': face.borderColor,
    'border-width': `${face.borderWidth}px`,
    'border-style': 'solid',
    ...(extended
      ? {
          'padding-left': `${FAB_HORIZONTAL_PADDING}px`,
          'padding-right': `${FAB_HORIZONTAL_PADDING}px`,
        }
      : {}),
  };
}

export function FloatingActionButton(
  props: FloatingActionButtonProps
): JSX.Element {
  const tokens = useThemeTokens();
  const extended = (): boolean => props.label !== undefined;
  const render = () =>
    resolveButtonRender(tokens.colors, {
      intent: props.intent ?? 'primary',
      variant: 'solid',
      disabled: props.disabled,
      loading: props.loading,
      feedback: props.feedback,
      onClick: props.onClick,
      onRetry: props.onRetry,
    });
  const fg = (): string => render().face.foregroundColor;
  const onColor: OnColorSet = {
    get fg() {
      return fg();
    },
    get fgMuted() {
      return fg();
    },
    get icon() {
      return fg();
    },
  };
  return (
    <button
      class={`clickable clickableTint ${fabContainerClass(extended())}`}
      {...dataAttrs({
        component: 'FloatingActionButton',
        phase: render().phase,
        ...props.dataSet,
      })}
      type="button"
      onClick={() => render().handleClick?.()}
      disabled={render().nonInteractive}
      aria-busy={render().phase === 'loading' ? true : undefined}
      aria-label={props['aria-label']}
      style={fabContainerStyle(extended(), render().face)}
    >
      <OnColorProvider value={onColor}>
        <div
          class="box relative z-[1] flex-row items-center"
          style={{ gap: `${spacingScale(FAB_CONTENT_GAP)}px` }}
        >
          <FabContent
            phase={render().phase}
            icon={props.icon ?? PlusIcon}
            foregroundColor={fg()}
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
      </OnColorProvider>
    </button>
  );
}
