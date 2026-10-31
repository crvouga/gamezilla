/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { iconSize } from '@pkgs/ui-root-shared-ts/sizes';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconComponent } from '../create-icon/index';
import { IconButton } from '../icon-button/index';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from '../icons';

export type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export type NoticeProps = {
  children: JSX.Element;
  /** Defaults to `neutral`. */
  tone?: NoticeTone | undefined;
  /** Overrides the tone's glyph. */
  icon?: IconComponent | undefined;
  id?: string | undefined;
  /** Shows a dismiss control; called when it is pressed. */
  onDismiss?: (() => void) | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const DISMISS_SIZE = 32;

function NoticeDismiss(props: { readonly onDismiss: () => void }): JSX.Element {
  const { t } = useLingui();
  return (
    <div class="box shrink-0">
      <IconButton
        onClick={() => props.onDismiss()}
        label={t`Dismiss`}
        aria-label={t`Dismiss`}
        tooltip="none"
        size={DISMISS_SIZE}
        dataSet={{ component: 'NoticeDismiss' }}
      >
        <XIcon size={iconSize.sm} color="icon" />
      </IconButton>
    </div>
  );
}

type NoticeToneSpec = {
  readonly surface: string;
  readonly iconColor: string;
  readonly icon: IconComponent;
};

const TONE: Record<NoticeTone, NoticeToneSpec> = {
  neutral: {
    surface: 'bg-surface-muted',
    iconColor: 'textSecondary',
    icon: InfoIcon,
  },
  info: {
    surface: 'bg-info-surface',
    iconColor: 'info',
    icon: InfoIcon,
  },
  success: {
    surface: 'bg-success-surface',
    iconColor: 'success',
    icon: CircleCheckIcon,
  },
  warning: {
    surface: 'bg-warning-surface',
    iconColor: 'warning',
    icon: TriangleAlertIcon,
  },
  error: {
    surface: 'bg-destructive-surface',
    iconColor: 'destructive',
    icon: CircleAlertIcon,
  },
};

/**
 * `Notice` -- an inline message block beside the content it is about: a
 * form's error, or a note on how something works.
 *
 * One rounded-control panel, 16 / 12px insets, a 16px glyph on the first
 * line. `neutral` (the default) is a quiet `surface-muted` well with a
 * secondary glyph; every other tone is that status's `*-surface` wash with
 * the glyph and copy in its hue. `tone="error"` is announced
 * (`role="alert"`). Give it an `id` so a field can point at it through
 * `aria-describedby`. `onDismiss` adds a close control at the end of the
 * first line, for a notice the person may put away once they have read it.
 *
 * @example
 * ```tsx
 * <Notice tone="error" id="email-error">{t`Couldn't find your account`}</Notice>
 * <Notice>{t`Changes apply on the next sign-in.`}</Notice>
 * <Notice tone="warning" onDismiss={acknowledge}>{t`Your space wasn't renamed`}</Notice>
 * ```
 */
export function Notice(props: NoticeProps): JSX.Element {
  const tone = (): NoticeToneSpec => TONE[props.tone ?? 'neutral'];
  return (
    <div
      id={props.id}
      role={props.tone === 'error' ? 'alert' : undefined}
      class="box flex-row items-start gap-3 rounded-control px-4 py-3"
      classList={{ [tone().surface]: true }}
      {...dataAttrs({
        component: 'Notice',
        tone: props.tone ?? 'neutral',
        ...props.dataSet,
      })}
    >
      <div class="box h-5 shrink-0 justify-center">
        <Dynamic
          component={props.icon ?? tone().icon}
          size={iconSize.sm}
          color={tone().iconColor}
        />
      </div>
      <div
        class="box flex-1 min-w-0 gap-1 textCaption"
        classList={{
          'text-info': props.tone === 'info',
          'text-success': props.tone === 'success',
          'text-warning': props.tone === 'warning',
          'text-destructive': props.tone === 'error',
        }}
      >
        {props.children}
      </div>
      <Show when={props.onDismiss}>
        {(onDismiss) => <NoticeDismiss onDismiss={onDismiss()} />}
      </Show>
    </div>
  );
}
