/** @jsxImportSource solid-js */
/**
 * Content sub-components for `Button`: idle label row and the loading /
 * success / error faces (with a width lock so feedback never collapses the
 * button to an icon-only square).
 */

import { type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { spacingScale } from '../../theme';
import { Box, joinClass } from '../box';
import { type IconComponent, XIcon } from '../icons';
import { Spinner } from '../spinner';
import { Text } from '../text';
import { type ButtonFeedback, MUTATION_FEEDBACK_ICONS } from './button-face';

export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonSizeSpec = {
  py: number;
  px: number;
  borderRadius: number;
  minHeight: number;
  text: {
    fontSize: number;
    lineHeight: number;
    fontWeight: '600' | '700' | '800';
  };
  iconSize: number;
  iconStrokeWidth: number;
  iconGap: number;
};

export const BUTTON_SIZES: Record<ButtonSize, ButtonSizeSpec> = {
  sm: {
    py: 1.5,
    px: 3,
    borderRadius: 10,
    minHeight: 32,
    text: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
    iconSize: 18,
    iconStrokeWidth: 2.75,
    iconGap: 1.5,
  },
  md: {
    py: 2.5,
    px: 4,
    borderRadius: 10,
    minHeight: 40,
    text: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
    iconSize: 22,
    iconStrokeWidth: 2.75,
    iconGap: 2,
  },
  lg: {
    py: 3,
    px: 5,
    borderRadius: 10,
    minHeight: 48,
    text: { fontSize: 19, lineHeight: 26, fontWeight: '800' },
    iconSize: 24,
    iconStrokeWidth: 3,
    iconGap: 2,
  },
};

export type ButtonLabels = {
  title: JSX.Element;
  loadingLabel?: JSX.Element | undefined;
  successLabel?: JSX.Element | undefined;
  errorLabel?: JSX.Element | undefined;
};

export type ButtonContentProps = {
  labels: ButtonLabels;
  phase: ButtonFeedback;
  size: ButtonSizeSpec;
  foregroundColor: string;
  /** Sized leading icon (preferred over `startIcon`). */
  icon?: IconComponent | undefined;
  startIcon?: JSX.Element | undefined;
  endIcon?: JSX.Element | undefined;
};

/** Blank strings do not reserve width; treat them as missing labels. */
export function coalesceButtonLabel(
  label: JSX.Element | undefined,
  fallback: JSX.Element
): JSX.Element {
  if (label === undefined || label === null) return fallback;
  if (typeof label === 'string' && label.trim() === '') return fallback;
  return label;
}

function rowClass(): string {
  return 'flex-row items-center justify-center';
}

function rowStyle(size: ButtonSizeSpec): JSX.CSSProperties {
  return { gap: `${spacingScale(size.iconGap)}px` };
}

export function ButtonLabelText(props: {
  label: JSX.Element;
  size: ButtonSizeSpec;
  foregroundColor: string;
}): JSX.Element {
  return (
    <Text
      variant="bodyBold"
      class="tracking-[0.1px] whitespace-nowrap"
      style={{
        color: props.foregroundColor,
        'font-size': `${props.size.text.fontSize}px`,
        'line-height': `${props.size.text.lineHeight}px`,
        'font-weight': props.size.text.fontWeight,
      }}
      label={props.label}
    />
  );
}

function IconSlot(props: { size: ButtonSizeSpec; children: JSX.Element }) {
  return (
    <Box
      class="items-center justify-center"
      style={{ height: `${props.size.iconSize}px` }}
    >
      {props.children}
    </Box>
  );
}

function ButtonIdleContent(props: ButtonContentProps): JSX.Element {
  return (
    <>
      <Show when={props.icon}>
        {(icon) => (
          <IconSlot size={props.size}>
            <Dynamic
              component={icon()}
              size={props.size.iconSize}
              strokeWidth={props.size.iconStrokeWidth}
              color={props.foregroundColor}
            />
          </IconSlot>
        )}
      </Show>
      <Show when={props.startIcon !== undefined}>
        <IconSlot size={props.size}>{props.startIcon}</IconSlot>
      </Show>
      <ButtonLabelText
        label={props.labels.title}
        size={props.size}
        foregroundColor={props.foregroundColor}
      />
      <Show when={props.endIcon !== undefined}>
        <IconSlot size={props.size}>{props.endIcon}</IconSlot>
      </Show>
    </>
  );
}

function ButtonStatusContent(props: {
  spinner?: boolean | undefined;
  icon?: IconComponent | undefined;
  size: ButtonSizeSpec;
  foregroundColor: string;
  label: JSX.Element | undefined;
}): JSX.Element {
  return (
    <>
      <Show
        when={props.spinner === true}
        fallback={
          <Dynamic
            component={props.icon ?? XIcon}
            size={props.size.iconSize}
            strokeWidth={props.size.iconStrokeWidth}
            color={props.foregroundColor}
          />
        }
      >
        <Spinner
          decorative
          color={props.foregroundColor}
          size={props.size.iconSize}
        />
      </Show>
      <Show when={props.label !== undefined && props.label !== null}>
        <ButtonLabelText
          label={props.label}
          size={props.size}
          foregroundColor={props.foregroundColor}
        />
      </Show>
    </>
  );
}

function ButtonFeedbackFace(props: ButtonContentProps): JSX.Element {
  const feedbackLabel = (): JSX.Element =>
    coalesceButtonLabel(
      props.phase === 'success'
        ? props.labels.successLabel
        : props.labels.errorLabel,
      props.labels.title
    );
  return (
    <Switch>
      <Match when={props.phase === 'loading'}>
        <ButtonStatusContent
          spinner
          size={props.size}
          foregroundColor={props.foregroundColor}
          label={props.labels.loadingLabel}
        />
      </Match>
      <Match when={props.phase === 'success' || props.phase === 'error'}>
        <ButtonStatusContent
          icon={
            props.phase === 'success'
              ? MUTATION_FEEDBACK_ICONS.success
              : MUTATION_FEEDBACK_ICONS.error
          }
          size={props.size}
          foregroundColor={props.foregroundColor}
          label={feedbackLabel()}
        />
      </Match>
    </Switch>
  );
}

/**
 * Keep the idle label's width while feedback content (spinner / check) is
 * shorter — otherwise success collapses to an icon-only square.
 */
function ButtonFeedbackWidthLock(props: ButtonContentProps): JSX.Element {
  return (
    <Box class={joinClass('relative', rowClass())} style={rowStyle(props.size)}>
      <Box
        class={joinClass(rowClass(), 'opacity-0 pointer-events-none')}
        style={rowStyle(props.size)}
        aria-hidden="true"
      >
        <ButtonIdleContent {...props} />
      </Box>
      <Box
        class={joinClass('absolute inset-0', rowClass())}
        style={rowStyle(props.size)}
      >
        <ButtonFeedbackFace {...props} />
      </Box>
    </Box>
  );
}

export function ButtonContent(props: ButtonContentProps): JSX.Element {
  return (
    <Show
      when={props.phase === 'idle'}
      fallback={<ButtonFeedbackWidthLock {...props} />}
    >
      <ButtonIdleContent {...props} />
    </Show>
  );
}
