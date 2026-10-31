/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { formatCompactNumber } from '../compact-number';
import { EyeIcon } from '../icons';
import { VisuallyHidden } from '../visually-hidden/index';

const EYE_SIZE = 16;

export type GameWatcherCountProps = {
  /** The number of people watching. */
  value: number;
  /** What a listener hears instead of the eye and the short number. */
  label: string;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Watching a game.
 *
 * - `GameWatcherCount`: how many people are watching, as an eye and a
 *   compact count (`12.4K`, the exact number on `data-value`) in a sunken
 *   round well. The caller names it (`12,400 watching`); the eye and the
 *   short number are for the eye only.
 * - `GameWatchingFooter`: the calm bar under a game that someone is only
 *   watching: an eye, the caller's words ("You're watching") and an
 *   optional action at the far edge ("Sit here").
 *
 * @example
 * ```tsx
 * <GameWatcherCount value={12_400} label="12,400 watching" />
 * <GameWatchingFooter title="You're watching" action={<Button title="Sit here" … />} />
 * ```
 */
export function GameWatcherCount(props: GameWatcherCountProps): JSX.Element {
  const { i18n } = useLingui();
  return (
    <span
      class="box inline-flex flex-row shrink-0 self-center items-center gap-1 rounded-full px-3 min-h-8 bg-surface-muted"
      {...dataAttrs({ component: 'GameWatcherCount', ...props.dataSet })}
      data-value={String(props.value)}
    >
      <span class="box flex-row items-center gap-1" aria-hidden="true">
        <EyeIcon size={EYE_SIZE} color="textSecondary" />
        <span class="text textLabel textNumeral text-text-secondary whitespace-nowrap">
          {formatCompactNumber(props.value, i18n().locale)}
        </span>
      </span>
      <VisuallyHidden>{props.label}</VisuallyHidden>
    </span>
  );
}

export type GameWatchingFooterProps = {
  /** The caller's words: "You're watching". */
  title: JSX.Element;
  /** One quiet line under it: "Moves appear as they are played." */
  detail?: JSX.Element | undefined;
  /** At the far edge: the one thing a watcher can do. */
  action?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function GameWatchingFooter(
  props: GameWatchingFooterProps
): JSX.Element {
  return (
    <div
      class="box flex-row flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 min-w-0"
      {...dataAttrs({ component: 'GameWatchingFooter', ...props.dataSet })}
    >
      <span class="box shrink-0" aria-hidden="true">
        <EyeIcon size={20} color="textSecondary" />
      </span>
      <div class="box flex-1 min-w-0 gap-1">
        <p class="text textLabel">{props.title}</p>
        <Show when={props.detail}>
          <p class="text textCaption">{props.detail}</p>
        </Show>
      </div>
      <Show when={props.action}>
        <div class="box flex-row items-center gap-2 shrink-0">
          {props.action}
        </div>
      </Show>
    </div>
  );
}
