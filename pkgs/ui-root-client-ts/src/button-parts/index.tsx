/** @jsxImportSource solid-js */

import { type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ButtonFeedback } from '../button-face';
import { MUTATION_FEEDBACK_ICONS } from '../button-face';
import type { IconComponent } from '../create-icon/index';
import { XIcon } from '../icons';
import { Spinner } from '../spinner/index';

export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Icon geometry per size, on the 4px grid. Paint (height, radius, padding,
 * type) lives in `skin.css` under `.btn[data-size]`; this is only what the
 * label row needs to place its icons. Classes are literal so Tailwind sees
 * them.
 */
export type ButtonSizeSpec = {
  /** Control height in px (`--ui-control-size-*`): 32 / 44 / 52. */
  minHeight: number;
  /** Icon glyph size in px: 16 / 20 / 20. */
  iconSize: number;
  iconStrokeWidth: number;
  /** Gap between icon and label: 4px (`gap-1`) or 8px (`gap-2`). */
  gapClass: string;
  /** Icon slot height, equal to `iconSize` (`h-4` / `h-5`). */
  slotClass: string;
  /** Icon rail width, equal to `iconSize` (`w-4` / `w-5`). */
  railClass: string;
  /** Equal side gutters, icon + gap (`px-5` = 20px, `px-7` = 28px). */
  gutterClass: string;
};

export const BUTTON_SIZES: Record<ButtonSize, ButtonSizeSpec> = {
  sm: {
    minHeight: 32,
    iconSize: 16,
    iconStrokeWidth: 2,
    gapClass: 'gap-1',
    slotClass: 'h-4',
    railClass: 'w-4',
    gutterClass: 'px-5',
  },
  md: {
    minHeight: 44,
    iconSize: 20,
    iconStrokeWidth: 2,
    gapClass: 'gap-2',
    slotClass: 'h-5',
    railClass: 'w-5',
    gutterClass: 'px-7',
  },
  lg: {
    minHeight: 52,
    iconSize: 20,
    iconStrokeWidth: 2,
    gapClass: 'gap-2',
    slotClass: 'h-5',
    railClass: 'w-5',
    gutterClass: 'px-7',
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

/**
 * Content sub-components for `Button`: idle label row and the loading /
 * success / error faces (with a width lock so feedback never collapses the
 * button to an icon-only square).
 *
 * Idle / status rows keep the label optically centered: equal side padding
 * reserves space for leading and trailing icons, which are absolutely
 * positioned in those gutters so they do not shift the text.
 */
export function ButtonLabelText(props: { label: JSX.Element }): JSX.Element {
  return <p class="text textBodyBold whitespace-nowrap">{props.label}</p>;
}

function IconSlot(props: { size: ButtonSizeSpec; children: JSX.Element }) {
  return (
    <div class={`box items-center justify-center ${props.size.slotClass}`}>
      {props.children}
    </div>
  );
}

/** Icon sits in a reserved side gutter; does not participate in label centering. */
function IconRail(props: {
  side: 'start' | 'end';
  size: ButtonSizeSpec;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={`box absolute inset-y-0 flex-row items-center justify-center ${props.size.railClass}`}
      classList={{
        'left-0': props.side === 'start',
        'right-0': props.side === 'end',
      }}
    >
      {props.children}
    </div>
  );
}

function CenteredLabelRow(props: {
  size: ButtonSizeSpec;
  padded: boolean;
  leading?: JSX.Element | undefined;
  trailing?: JSX.Element | undefined;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={`box ${rowClass()}`}
      classList={{ [props.size.gutterClass]: props.padded }}
    >
      {props.leading}
      {props.children}
      {props.trailing}
    </div>
  );
}

function SizedLeadingIcon(props: ButtonContentProps): JSX.Element {
  return (
    <Show when={props.icon}>
      {(icon) => (
        <IconSlot size={props.size}>
          <Dynamic
            component={icon()}
            size={props.size.iconSize}
            strokeWidth={props.size.iconStrokeWidth}
          />
        </IconSlot>
      )}
    </Show>
  );
}

function ButtonIdleContent(props: ButtonContentProps): JSX.Element {
  const hasLeading = (): boolean =>
    props.icon !== undefined || props.startIcon !== undefined;
  const hasTrailing = (): boolean => props.endIcon !== undefined;
  return (
    <div class={`box ${rowClass()} ${props.size.gapClass}`}>
      <Show when={hasLeading()}>
        <SizedLeadingIcon {...props} />
        <Show when={props.startIcon !== undefined}>
          <IconSlot size={props.size}>{props.startIcon}</IconSlot>
        </Show>
      </Show>
      <ButtonLabelText label={props.labels.title} />
      <Show when={hasTrailing()}>
        <IconSlot size={props.size}>{props.endIcon}</IconSlot>
      </Show>
    </div>
  );
}

function StatusGlyph(props: {
  spinner?: boolean | undefined;
  icon?: IconComponent | undefined;
  size: ButtonSizeSpec;
}): JSX.Element {
  return (
    <Show
      when={props.spinner === true}
      fallback={
        <Dynamic
          component={props.icon ?? XIcon}
          size={props.size.iconSize}
          strokeWidth={props.size.iconStrokeWidth}
        />
      }
    >
      <Spinner decorative color="current" size="sm" />
    </Show>
  );
}

function ButtonStatusContent(props: {
  spinner?: boolean | undefined;
  icon?: IconComponent | undefined;
  size: ButtonSizeSpec;
  label: JSX.Element | undefined;
}): JSX.Element {
  const hasLabel = (): boolean =>
    props.label !== undefined && props.label !== null;
  return (
    <Show
      when={hasLabel()}
      fallback={
        <div class={`box ${rowClass()}`}>
          <StatusGlyph {...props} />
        </div>
      }
    >
      <CenteredLabelRow
        size={props.size}
        padded
        leading={
          <IconRail side="start" size={props.size}>
            <StatusGlyph {...props} />
          </IconRail>
        }
      >
        <ButtonLabelText label={props.label} />
      </CenteredLabelRow>
    </Show>
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
          label={props.labels.loadingLabel}
        />
        <Show when={props.labels.loadingLabel == null}>
          <span class="sr-only">{props.labels.title}</span>
        </Show>
      </Match>
      <Match when={props.phase === 'success' || props.phase === 'error'}>
        <ButtonStatusContent
          icon={
            props.phase === 'success'
              ? MUTATION_FEEDBACK_ICONS.success
              : MUTATION_FEEDBACK_ICONS.error
          }
          size={props.size}
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
    <div class={`relative box ${rowClass()}`}>
      <div
        class={`opacity-0 pointer-events-none box ${rowClass()}`}
        aria-hidden="true"
      >
        <ButtonIdleContent {...props} />
      </div>
      <div class={`absolute inset-0 box ${rowClass()}`}>
        <ButtonFeedbackFace {...props} />
      </div>
    </div>
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
