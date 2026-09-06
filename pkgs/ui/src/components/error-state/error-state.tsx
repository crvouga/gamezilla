/** @jsxImportSource solid-js */
/**
 * `ErrorState` -- canonical failure block.
 *
 * Reach for this anywhere you would have hand-rolled a destructive `Text`
 * inside a padded `Box`, or a tinted "ErrorCard" with `destructive` border
 * + `destructiveSurface` fill. Pairs an icon with a title, optional body
 * (typically the raw error message), optional copy-error button (when body
 * is stringifiable and a `copy` sink is injected), and optional retry button.
 *
 * Variants:
 *   - `'fill'`    (default) -- centered failure inside `flex: 1`. Use for
 *                              boot failures and full-screen errors.
 *   - `'compact'` -- destructive-tinted card with a left-aligned icon row,
 *                    sized to inline content (replaces ad-hoc ErrorCards).
 *
 * @example
 * ```tsx
 * <ErrorState title={t`Playground failed to start`} body={boot.bootErr} />
 * <ErrorState variant="compact" title={t`Failed to load metrics`} body={msg} />
 * ```
 */

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Button } from '../button';
import { type IconComponent, XIcon } from '../icons';
import { StateBlock, type StateBlockVariant } from '../state-block';
import { Text } from '../text';

export type ErrorStateRetry = {
  label?: JSX.Element | undefined;
  onClick: () => void;
};

/** Injected clipboard sink (never a bare `navigator.clipboard`). */
export type ErrorStateCopy = (text: string) => Promise<void>;

export type ErrorStateProps = {
  /** Defaults to the X mark from the design-system icon set. */
  icon?: IconComponent | undefined;
  title: JSX.Element;
  /** Error detail (string or any node). */
  body?: JSX.Element | undefined;
  /** Optional retry action button. */
  retry?: ErrorStateRetry | undefined;
  /** Clipboard sink; when provided (and body is text) a "Copy error" button shows. */
  copy?: ErrorStateCopy | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: StateBlockVariant | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const ICON_SIZE_FILL = 32;
const ICON_SIZE_COMPACT = 20;
export const ERROR_COPIED_RESET_MS = 1500;

const noopCopy: ErrorStateCopy = () => Promise.resolve();

function nodeToCopyString(node: JSX.Element): string | null {
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  return null;
}

/** Build clipboard text from stringifiable title + body; null when body is not. */
export function errorCopyText(
  title: JSX.Element,
  body: JSX.Element | undefined
): string | null {
  const bodyText = nodeToCopyString(body);
  if (bodyText === null) return null;
  const titleText = nodeToCopyString(title);
  if (titleText === null) return bodyText;
  return `${titleText}\n${bodyText}`;
}

function ErrorCopyButton(props: {
  copyText: string;
  copy: ErrorStateCopy;
}): JSX.Element {
  const { t } = useLingui();
  const timers = useTimers();
  const [copied, setCopied] = createSignal(false);
  createEffect(() => {
    if (!copied()) return;
    const id = timers.setTimeout(() => setCopied(false), ERROR_COPIED_RESET_MS);
    onCleanup(() => timers.clearTimeout(id));
  });
  const onCopy = async (): Promise<void> => {
    try {
      await props.copy(props.copyText);
    } catch {
      return;
    }
    setCopied(true);
  };
  return (
    <Button
      title={copied() ? t`Copied` : t`Copy error`}
      intent="neutral"
      variant="outline"
      size="sm"
      onClick={() => {
        void onCopy();
      }}
    />
  );
}

function ErrorActions(props: {
  copyText: string | null;
  copy: ErrorStateCopy | undefined;
  retry: ErrorStateRetry | undefined;
  align: 'center' | 'start';
}): JSX.Element {
  const { t } = useLingui();
  const showCopy = (): boolean =>
    props.copyText !== null && props.copy !== undefined;
  return (
    <Show when={showCopy() || props.retry !== undefined}>
      <Box
        sx={{
          mt: props.align === 'start' ? 1 : 0,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: props.align === 'center' ? 'center' : 'flex-start',
          gap: 2,
        }}
      >
        <Show when={showCopy()}>
          <ErrorCopyButton
            copyText={props.copyText ?? ''}
            copy={props.copy ?? noopCopy}
          />
        </Show>
        <Show when={props.retry}>
          {(retry) => (
            <Button
              title={retry().label ?? t`Retry`}
              intent="danger"
              variant="outline"
              size="sm"
              onClick={() => retry().onClick()}
            />
          )}
        </Show>
      </Box>
    </Show>
  );
}

function ErrorStateFill(props: ErrorStateProps): JSX.Element {
  return (
    <StateBlock
      variant="fill"
      role="alert"
      dataSet={{ component: 'ErrorState', ...props.dataSet }}
    >
      <Dynamic
        component={props.icon ?? XIcon}
        size={ICON_SIZE_FILL}
        color="destructive"
      />
      <Text
        variant="bodyBold"
        sx={{ color: 'destructive', textAlign: 'center' }}
        label={props.title}
      />
      <Show when={props.body !== undefined && props.body !== null}>
        <Text
          variant="caption"
          sx={{ color: 'textSecondary', textAlign: 'center' }}
          label={props.body}
        />
      </Show>
      <ErrorActions
        copyText={errorCopyText(props.title, props.body)}
        copy={props.copy}
        retry={props.retry}
        align="center"
      />
    </StateBlock>
  );
}

function ErrorStateCompact(props: ErrorStateProps): JSX.Element {
  return (
    <Box
      role="alert"
      dataSet={{ component: 'ErrorState', ...props.dataSet }}
      sx={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 3,
        p: 3,
        borderWidth: 1,
        borderColor: 'destructive',
        backgroundColor: 'destructiveSurface',
        borderRadius: 'md',
      }}
    >
      <Box sx={{ pt: 0.5 }}>
        <Dynamic
          component={props.icon ?? XIcon}
          size={ICON_SIZE_COMPACT}
          color="destructive"
        />
      </Box>
      <Box sx={{ flex: 1, gap: 1 }}>
        <Text
          variant="bodyBold"
          sx={{ color: 'destructive' }}
          label={props.title}
        />
        <Show when={props.body !== undefined && props.body !== null}>
          <Text
            variant="caption"
            sx={{ color: 'destructive' }}
            label={props.body}
          />
        </Show>
        <ErrorActions
          copyText={errorCopyText(props.title, props.body)}
          copy={props.copy}
          retry={props.retry}
          align="start"
        />
      </Box>
    </Box>
  );
}

export function ErrorState(props: ErrorStateProps): JSX.Element {
  return (
    <Show
      when={(props.variant ?? 'fill') === 'compact'}
      fallback={<ErrorStateFill {...props} />}
    >
      <ErrorStateCompact {...props} />
    </Show>
  );
}
