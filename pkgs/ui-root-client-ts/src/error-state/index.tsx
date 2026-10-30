/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { cssGap, cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { iconSize } from '@pkgs/ui-root-shared-ts/sizes';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Button } from '../button/index';
import { BUTTON_SIZES, type ButtonSize } from '../button-parts/index';
import type { IconComponent } from '../create-icon/index';
import { XIcon } from '../icons';
import type { StateBlockVariant } from '../state-block/index';
import { StateBlock, StateBlockIcon } from '../state-block/index';

export type ErrorStateRetry = {
  dataSet?: ComponentDataSet | undefined;
  label?: JSX.Element | undefined;
  onClick: () => void;
};

export type ErrorStateSecondary = {
  label: JSX.Element;
  onClick: () => void;
  /** DOM `data-*` identifiers for the button (a test handle). */
  dataSet?: ComponentDataSet | undefined;
};

/** Injected clipboard sink (never a bare `navigator.clipboard`). */
export type ErrorStateCopy = (text: string) => Promise<void>;

export type ErrorStateProps = {
  /** Defaults to the X mark from the design-system icon set. */
  icon?: IconComponent | undefined;
  /** What broke, in sentence case and without an exclamation mark. */
  title: JSX.Element;
  /**
   * What to do next (and, where it helps, the detail of what failed).
   * Required: a failure always comes with a way forward.
   */
  body: JSX.Element;
  /** The retry action: the primary recovery. Label defaults to "Retry". */
  retry?: ErrorStateRetry | undefined;
  /** Optional second recovery. Outline, never a second primary. */
  secondary?: ErrorStateSecondary | undefined;
  /** Extra detail under the actions (a disclosure, a trace). */
  details?: JSX.Element | undefined;
  /** Clipboard sink; when provided (and body is text) a "Copy error" button shows. */
  copy?: ErrorStateCopy | undefined;
  /** Layout density. Defaults to `'fill'`. */
  variant?: ErrorStateLayout | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** The band is a fixed-height slot, so its insets are pinned as lengths. */
const BAND_PAD = 12;

export type ErrorStateLayout = StateBlockVariant | 'band';
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

function needsErrorCatalog(
  copy: Accessor<ErrorStateCopy | undefined>,
  retry: Accessor<ErrorStateRetry | undefined>
): Accessor<boolean> {
  return () => {
    if (copy() !== undefined) return true;
    const retryAction = retry();
    return retryAction !== undefined && retryAction.label === undefined;
  };
}

function ErrorActionRow(props: {
  align: 'center' | 'start';
  /** Drop the extra top margin when the parent already gaps its rows. */
  flush?: boolean | undefined;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box flex-row flex-wrap items-center gap-2"
      classList={{
        'justify-center': props.align === 'center',
        'justify-start': props.align === 'start',
        'mt-2': props.flush !== true && props.align === 'center',
        'mt-1': props.flush !== true && props.align === 'start',
      }}
    >
      {props.children}
    </div>
  );
}

function PrimaryRecovery(props: {
  dataSet?: ComponentDataSet | undefined;
  label: JSX.Element;
  onClick: () => void;
  size: ButtonSize;
}): JSX.Element {
  return (
    <Button
      dataSet={props.dataSet}
      title={props.label}
      intent="primary"
      size={props.size}
      onClick={() => props.onClick()}
    />
  );
}

function SecondaryRecovery(props: {
  action: ErrorStateSecondary;
  size: ButtonSize;
}): JSX.Element {
  return (
    <Button
      title={props.action.label}
      intent="neutral"
      variant="outline"
      size={props.size}
      onClick={() => props.action.onClick()}
      dataSet={props.action.dataSet}
    />
  );
}

type ErrorActionProps = {
  copyText: string | null;
  copy: ErrorStateCopy | undefined;
  retry: ErrorStateRetry | undefined;
  secondary: ErrorStateSecondary | undefined;
  align: 'center' | 'start';
  size: ButtonSize;
  flush?: boolean | undefined;
};

function SpecifiedErrorActions(props: ErrorActionProps): JSX.Element {
  const show = (): boolean =>
    (props.retry?.label !== undefined && props.retry.label !== null) ||
    props.secondary !== undefined;
  return (
    <Show when={show()}>
      <ErrorActionRow align={props.align} flush={props.flush}>
        <Show when={props.retry?.label !== undefined}>
          <PrimaryRecovery
            dataSet={props.retry?.dataSet}
            label={props.retry?.label ?? ''}
            onClick={() => props.retry?.onClick()}
            size={props.size}
          />
        </Show>
        <Show when={props.secondary}>
          {(action) => (
            <SecondaryRecovery action={action()} size={props.size} />
          )}
        </Show>
      </ErrorActionRow>
    </Show>
  );
}

function CatalogErrorActions(props: ErrorActionProps): JSX.Element {
  const { t } = useLingui();
  const showCopy = (): boolean =>
    props.copyText !== null && props.copy !== undefined;
  return (
    <Show when={showCopy() || props.retry !== undefined || props.secondary}>
      <ErrorActionRow align={props.align} flush={props.flush}>
        <Show when={showCopy()}>
          <ErrorCopyButton
            copyText={props.copyText ?? ''}
            copy={props.copy ?? noopCopy}
          />
        </Show>
        <Show when={props.retry}>
          {(retry) => (
            <PrimaryRecovery
              dataSet={retry().dataSet}
              label={retry().label ?? t`Retry`}
              onClick={() => retry().onClick()}
              size={props.size}
            />
          )}
        </Show>
        <Show when={props.secondary}>
          {(action) => (
            <SecondaryRecovery action={action()} size={props.size} />
          )}
        </Show>
      </ErrorActionRow>
    </Show>
  );
}

function ErrorActions(props: ErrorActionProps): JSX.Element {
  return (
    <Show
      when={needsErrorCatalog(
        () => props.copy,
        () => props.retry
      )}
      fallback={<SpecifiedErrorActions {...props} />}
    >
      <CatalogErrorActions {...props} />
    </Show>
  );
}

function ErrorDetails(props: {
  details: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Show when={props.details !== undefined && props.details !== null}>
      <div class="box w-full items-stretch gap-3 mt-2">{props.details}</div>
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
      <StateBlockIcon icon={props.icon ?? XIcon} tone="destructive" />
      <h1 class="text textSubtitle text-center w-full">{props.title}</h1>
      <p class="text textBody text-text-secondary text-center w-full">
        {props.body}
      </p>
      <ErrorActions
        copyText={errorCopyText(props.title, props.body)}
        copy={props.copy}
        retry={props.retry}
        secondary={props.secondary}
        align="center"
        size="md"
      />
      <ErrorDetails details={props.details} />
    </StateBlock>
  );
}

function ErrorStateCompact(props: ErrorStateProps): JSX.Element {
  return (
    <div
      class="box flex-row items-start gap-3 px-4 py-3 bg-destructive-surface rounded-control"
      {...dataAttrs({ component: 'ErrorState', ...props.dataSet })}
      role="alert"
    >
      <div class="box h-6 shrink-0 justify-center">
        <Dynamic
          component={props.icon ?? XIcon}
          size={iconSize.md}
          color="destructive"
        />
      </div>
      <div class="box flex-1 min-w-0 gap-1">
        <p class="text textBodyBold text-destructive">{props.title}</p>
        <p class="text textCaption text-destructive">{props.body}</p>
        <ErrorActions
          copyText={errorCopyText(props.title, props.body)}
          copy={props.copy}
          retry={props.retry}
          secondary={props.secondary}
          align="start"
          size="sm"
        />
        <ErrorDetails details={props.details} />
      </div>
    </div>
  );
}

/** Fills a fixed-height parent. The copy clips; the retry stays in the band. */
function ErrorStateBand(props: ErrorStateProps): JSX.Element {
  return (
    <div
      class="box h-full w-full items-center overflow-hidden"
      {...dataAttrs({ component: 'ErrorState', ...props.dataSet })}
      role="alert"
      style={{
        display: 'flex',
        'flex-direction': 'column',
        height: '100%',
        'min-height': cssPx(0),
        overflow: 'hidden',
        'box-sizing': 'border-box',
        'padding-top': cssPx(BAND_PAD),
        'padding-bottom': cssPx(BAND_PAD),
        'padding-left': cssPx(BAND_PAD),
        'padding-right': cssPx(BAND_PAD),
        gap: cssGap(2),
      }}
    >
      <BandMessage {...props} />
      <div
        class="box w-full shrink-0 items-center"
        style={{
          'flex-shrink': '0',
          'min-height': cssPx(BUTTON_SIZES.sm.minHeight),
          margin: '0',
        }}
      >
        <ErrorActions
          copyText={errorCopyText(props.title, props.body)}
          copy={props.copy}
          retry={props.retry}
          secondary={props.secondary}
          align="center"
          size="sm"
          flush
        />
      </div>
    </div>
  );
}

function BandMessage(props: ErrorStateProps): JSX.Element {
  return (
    <div
      class="box w-full min-h-0 items-center gap-2 overflow-hidden"
      style={{
        display: 'flex',
        'flex-direction': 'column',
        flex: '1 1 0%',
        'min-height': cssPx(0),
        overflow: 'hidden',
      }}
    >
      <Dynamic
        component={props.icon ?? XIcon}
        size={iconSize.md}
        color="destructive"
      />
      <p class="text textBodyBold text-center line-clamp-2 w-full">
        {props.title}
      </p>
      <p class="text textCaption text-text-secondary text-center w-full">
        {props.body}
      </p>
      <ErrorDetails details={props.details} />
    </div>
  );
}

/**
 * `ErrorState` -- canonical failure block.
 *
 * Says what broke and what to do about it: the `title` names the failure
 * ("Couldn't load your spaces"), the required `body` says what to do next
 * ("Check your connection and try again."), and `retry` is the thing to do,
 * the one blue primary. A second recovery stays an outline, as does the
 * copy-error button (shown when the body is text and a `copy` sink is
 * injected). Copy is short, second person and calm: no exclamation marks,
 * and never "contact support" -- there is none; offer the next step instead.
 *
 * Variants:
 *   - `'fill'`    (default) -- centered failure: the glyph in a hairline
 *                              disc, a plain title, the guidance in secondary
 *                              text. Use for boot failures and full-screen
 *                              errors.
 *   - `'compact'` -- a `destructive-surface` wash with a left-aligned icon
 *                    row, sized to inline content (replaces ad-hoc ErrorCards).
 *   - `'band'`    -- fills a fixed-height parent. The message shrinks and
 *                    clips; the retry stays fully inside the band.
 *
 * @example
 * ```tsx
 * <ErrorState
 *   title={t`Couldn't load your spaces`}
 *   body={t`Check your connection and try again.`}
 *   retry={{ onClick: refetch }}
 * />
 * <ErrorState
 *   variant="compact"
 *   title={t`Couldn't load metrics`}
 *   body={t`Refresh to try again.`}
 * />
 * ```
 */
export function ErrorState(props: ErrorStateProps): JSX.Element {
  return (
    <Show
      when={props.variant === 'band'}
      fallback={
        <Show
          when={(props.variant ?? 'fill') === 'compact'}
          fallback={<ErrorStateFill {...props} />}
        >
          <ErrorStateCompact {...props} />
        </Show>
      }
    >
      <ErrorStateBand {...props} />
    </Show>
  );
}
