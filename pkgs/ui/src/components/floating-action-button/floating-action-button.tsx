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
import type { ComponentDataSet } from '../../component-id';
import {
  OnColorProvider,
  type OnColorSet,
  type SxProps,
  useThemeTokens,
} from '../../theme';
import { Box } from '../box';
import {
  type ButtonFace,
  type ButtonFeedback,
  type ButtonIntent,
  MUTATION_FEEDBACK_ICONS,
  resolveButtonRender,
} from '../button';
import { Clickable } from '../clickable';
import { type IconComponent, PlusIcon } from '../icons';
import { Spinner } from '../spinner';
import { Text } from '../text';

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
    <Text
      variant="bodyBold"
      sx={{
        color: props.foregroundColor,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600',
        whiteSpace: 'nowrap',
      }}
      label={props.label}
    />
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

function fabContainerSx(extended: boolean, face: ButtonFace): SxProps {
  return {
    height: FAB_SIZE,
    minHeight: FAB_SIZE,
    borderRadius: 'full',
    backgroundColor: face.backgroundColor,
    borderColor: face.borderColor,
    borderWidth: face.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    transitionProperty: 'background-color, border-color',
    transitionDuration: 'var(--ui-duration-fast)',
    ...(extended
      ? { paddingHorizontal: FAB_HORIZONTAL_PADDING }
      : { width: FAB_SIZE }),
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
    <Clickable
      onClick={() => render().handleClick?.()}
      disabled={render().nonInteractive}
      aria-busy={render().phase === 'loading' ? true : undefined}
      aria-label={props['aria-label']}
      dataSet={{
        component: 'FloatingActionButton',
        phase: render().phase,
        ...props.dataSet,
      }}
      sx={fabContainerSx(extended(), render().face)}
    >
      <OnColorProvider value={onColor}>
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAB_CONTENT_GAP,
          }}
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
        </Box>
      </OnColorProvider>
    </Clickable>
  );
}
