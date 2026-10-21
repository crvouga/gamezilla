/** @jsxImportSource solid-js */
/**
 * `Notice` -- an inline message block beside the content it is about: a
 * form's error, or a note on how something works.
 *
 * One rounded-control panel, 16 / 12px insets, a 16px glyph on the first
 * line. `neutral` (the default) is a quiet `surface-muted` well with a
 * secondary glyph; every other tone is that status's `*-surface` wash with
 * the glyph and copy in its hue. `tone="error"` is announced
 * (`role="alert"`). Give it an `id` so a field can point at it through
 * `aria-describedby`.
 *
 * @example
 * ```tsx
 * <Notice tone="error" id="email-error">{t`Couldn't find your account`}</Notice>
 * <Notice>{t`Changes apply on the next sign-in.`}</Notice>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { iconSize } from '@pkgs/ui-root-shared/sizes';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconComponent } from './create-icon';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from './icons';

export type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export type NoticeProps = {
  children: JSX.Element;
  /** Defaults to `neutral`. */
  tone?: NoticeTone | undefined;
  /** Overrides the tone's glyph. */
  icon?: IconComponent | undefined;
  id?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

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
    </div>
  );
}
