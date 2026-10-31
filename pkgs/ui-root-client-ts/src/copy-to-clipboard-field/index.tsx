/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { CircleCheckIcon, CopyIcon } from '../icons';

export const DEFAULT_COPIED_RESET_MS = 2000;
const ICON_SIZE = 22;

/** Injected clipboard sink. */
export type ClipboardCopy = (text: string) => Promise<void>;

export type CopyToClipboardFieldProps = {
  /** String written to the clipboard on click. */
  value: string;
  /** Clipboard sink (injected from the composition root). */
  copy: ClipboardCopy;
  /** Optional label above the field (same role as TextInput `label`). */
  label?: JSX.Element | undefined;
  /** Shown below the field when idle (hidden while `copiedLabel` is showing). */
  helperText?: LocalizedString | undefined;
  /** Shown briefly after a successful copy. */
  copiedLabel?: LocalizedString | undefined;
  /** How long to show `copiedLabel` before returning to helper/idle. */
  copiedResetMs?: number | undefined;
  /** When true, the value is user-selectable as well as copy-on-click. */
  selectable?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  /** `data-*` for the button that copies. */
  triggerDataSet?: ComponentDataSet | undefined;
};

/**
 * Read-only "text field" that copies `value` to the clipboard when clicked.
 * The clipboard sink is injected (`copy` prop) — never a bare
 * `navigator.clipboard`. Copy / check icons swap instantly on success; the
 * optional helper line shows "Copied" feedback then resets on the injected
 * timers.
 */
export function CopyToClipboardField(
  props: CopyToClipboardFieldProps
): JSX.Element {
  const { t } = useLingui();
  const timers = useTimers();

  const [copied, setCopied] = createSignal(false);
  const copiedLabel = (): LocalizedString =>
    props.copiedLabel ?? t`Copied to clipboard`;

  createEffect(() => {
    if (!copied()) return;
    const id = timers.setTimeout(
      () => setCopied(false),
      props.copiedResetMs ?? DEFAULT_COPIED_RESET_MS
    );
    onCleanup(() => timers.clearTimeout(id));
  });

  const onCopy = async (): Promise<void> => {
    try {
      await props.copy(props.value);
    } catch {
      return;
    }
    setCopied(true);
  };

  return (
    <div
      class="box gap-1"
      {...dataAttrs({ component: 'CopyToClipboardField', ...props.dataSet })}
    >
      <Show when={props.label !== undefined}>
        <label class="text textLabel">{props.label}</label>
      </Show>
      <button
        class="clickable clickableOpacity flex-row items-center gap-2 border border-outline rounded-control bg-surface-muted py-3 px-3 text-left"
        {...dataAttrs({
          component: 'CopyToClipboardTrigger',
          ...props.triggerDataSet,
        })}
        data-copied={String(copied())}
        type="button"
        aria-label={copied() ? copiedLabel() : t`Copy to clipboard`}
        onClick={() => {
          void onCopy();
        }}
      >
        <div class="box flex-1 min-w-0">
          <p
            class="text"
            classList={{
              'select-none': props.selectable === false,
              'select-text': props.selectable !== false,
            }}
          >
            {props.value}
          </p>
        </div>
        <div class="box items-center justify-center">
          <Show
            when={copied()}
            fallback={<CopyIcon size={ICON_SIZE} color="icon" />}
          >
            <CircleCheckIcon size={ICON_SIZE} color="tint" />
          </Show>
        </div>
      </button>
      <div class="box min-h-5" role="status" aria-live="polite">
        <Show
          when={copied()}
          fallback={
            <Show when={props.helperText !== undefined}>
              <p class="text textCaption">{props.helperText}</p>
            </Show>
          }
        >
          <p class="text textCaption">{copiedLabel()}</p>
        </Show>
      </div>
    </div>
  );
}
