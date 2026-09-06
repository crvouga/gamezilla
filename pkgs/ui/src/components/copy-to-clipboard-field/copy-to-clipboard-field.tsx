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
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { CircleCheckIcon, CopyIcon } from '../icons';
import { Motion } from '../motion';
import { Text } from '../text';

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
  sx?: SxInput | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

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
    <Box
      sx={[{ gap: 1 }, props.sx]}
      dataSet={{ component: 'CopyToClipboardField', ...props.dataSet }}
    >
      <Show when={props.label !== undefined}>
        <Text variant="label" label={props.label} />
      </Show>
      <Clickable
        aria-label={copied() ? copiedLabel() : t`Copy to clipboard`}
        onClick={() => {
          void onCopy();
        }}
        feedback="opacity"
        dataSet={{
          component: 'CopyToClipboardTrigger',
          copied: String(copied()),
        }}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          borderWidth: 1,
          borderColor: 'outline',
          borderRadius: 'md',
          backgroundColor: 'surfaceMuted',
          paddingVertical: 10,
          paddingHorizontal: 12,
          textAlign: 'left',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="body"
            sx={{ userSelect: props.selectable === false ? 'none' : 'text' }}
            label={props.value}
          />
        </Box>
        <Motion
          duration="fast"
          property="transform, color"
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: copied() ? 1.1 : 1 }],
          }}
        >
          <Show
            when={copied()}
            fallback={<CopyIcon size={ICON_SIZE} color="icon" />}
          >
            <CircleCheckIcon size={ICON_SIZE} color="tint" />
          </Show>
        </Motion>
      </Clickable>
      <Box role="status" aria-live="polite" sx={{ minHeight: 18 }}>
        <Show
          when={copied()}
          fallback={
            <Show when={props.helperText !== undefined}>
              <Text variant="caption" label={props.helperText} />
            </Show>
          }
        >
          <Text variant="caption" label={copiedLabel()} />
        </Show>
      </Box>
    </Box>
  );
}
