/** @jsxImportSource solid-js */
/**
 * `Notice` -- an inline message block beside the content it is about: a
 * form's error, or a note on how something works.
 *
 * `tone="error"` is announced (`role="alert"`) and tinted destructive;
 * `tone="info"` is a quiet muted panel. Give it an `id` so a field can point
 * at it through `aria-describedby`.
 *
 * @example
 * ```tsx
 * <Notice tone="error" id="email-error">{t`Couldn't find your account`}</Notice>
 * <Notice>{t`Changes apply on the next sign-in.`}</Notice>
 * ```
 */

import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { CircleAlertIcon, InfoIcon } from './icons';
import type { IconComponent } from './create-icon';

export type NoticeTone = 'info' | 'error';

export type NoticeProps = {
  children: JSX.Element;
  /** Defaults to `info`. */
  tone?: NoticeTone | undefined;
  /** Overrides the tone's glyph. */
  icon?: IconComponent | undefined;
  id?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const NOTICE_ICON_SIZE = 16;

export function Notice(props: NoticeProps): JSX.Element {
  const isError = (): boolean => props.tone === 'error';
  const icon = (): IconComponent =>
    props.icon ?? (isError() ? CircleAlertIcon : InfoIcon);
  return (
    <div
      id={props.id}
      role={isError() ? 'alert' : undefined}
      class="box flex-row items-start gap-2 rounded-control px-3 py-2.5"
      classList={{
        'bg-destructive-surface': isError(),
        'bg-surface-muted': !isError(),
      }}
      {...dataAttrs({ component: 'Notice', ...props.dataSet })}
    >
      <div class="box h-4.5 justify-center">
        <Dynamic
          component={icon()}
          size={NOTICE_ICON_SIZE}
          color={isError() ? 'destructive' : 'textSecondary'}
        />
      </div>
      <div
        class="box flex-1 gap-1 textCaption"
        classList={{ 'text-destructive': isError() }}
      >
        {props.children}
      </div>
    </div>
  );
}
