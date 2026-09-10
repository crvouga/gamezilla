/** @jsxImportSource solid-js */
/**
 * Read-only "text field" that copies `value` to the clipboard when clicked.
 * The clipboard sink is injected (`copy` prop) — never a bare
 * `navigator.clipboard`. Copy / check icons swap with a CSS transition on
 * success; the optional helper line shows "Copied" feedback then resets on
 * the injected timers.
 */

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import type { LocalizedString } from '@pkgs/i18n';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
} from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import type { DivBoxProps } from '../box';
import { CircleCheckIcon, CopyIcon } from '../icons';
import { Motion } from '../motion';

export const DEFAULT_COPIED_RESET_MS = 2000;
const ICON_SIZE = 22;

/** Injected clipboard sink. */
export type ClipboardCopy = (text: string) => Promise<void>;

export type CopyToClipboardFieldProps = Omit<DivBoxProps, 'children'> & {
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
};

export function CopyToClipboardField(
  props: CopyToClipboardFieldProps
): JSX.Element {
  const { t } = useLingui();
  const timers = useTimers();
  const [local, rest] = splitProps(props, [
    'value',
    'copy',
    'label',
    'helperText',
    'copiedLabel',
    'copiedResetMs',
    'selectable',
    'class',
    'dataSet',
  ]);
  const [copied, setCopied] = createSignal(false);
  const copiedLabel = (): LocalizedString =>
    local.copiedLabel ?? t`Copied to clipboard`;

  createEffect(() => {
    if (!copied()) return;
    const id = timers.setTimeout(
      () => setCopied(false),
      local.copiedResetMs ?? DEFAULT_COPIED_RESET_MS
    );
    onCleanup(() => timers.clearTimeout(id));
  });

  const onCopy = async (): Promise<void> => {
    try {
      await local.copy(local.value);
    } catch {
      return;
    }
    setCopied(true);
  };

  return (
    <div
      class="box gap-1"
      classList={{ [String(local.class)]: true }}
      {...dataAttrs({ component: 'CopyToClipboardField', ...local.dataSet })}
      {...rest}
    >
      <Show when={local.label !== undefined}>
        <label class="text textLabel">{local.label}</label>
      </Show>
      <button
        class="clickable clickableOpacity flex-row items-center gap-2 border border-outline rounded-[10px] bg-surface-muted py-2.5 px-3 text-left"
        data-component="CopyToClipboardTrigger"
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
            style={{
              'user-select': local.selectable === false ? 'none' : 'text',
            }}
          >
            {local.value}
          </p>
        </div>
        <Motion
          class="items-center justify-center"
          style={{
            transform: `scale(${copied() ? 1.1 : 1})`,
          }}
          duration="fast"
          property="transform, color"
        >
          <Show
            when={copied()}
            fallback={<CopyIcon size={ICON_SIZE} color="icon" />}
          >
            <CircleCheckIcon size={ICON_SIZE} color="tint" />
          </Show>
        </Motion>
      </button>
      <div class="box min-h-[18px]" role="status" aria-live="polite">
        <Show
          when={copied()}
          fallback={
            <Show when={local.helperText !== undefined}>
              <p class="text textCaption">{local.helperText}</p>
            </Show>
          }
        >
          <p class="text textCaption">{copiedLabel()}</p>
        </Show>
      </div>
    </div>
  );
}
