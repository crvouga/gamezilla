/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { For, type JSX, Match, Show, Switch } from 'solid-js';

export type SkeletonShape = 'text' | 'rect' | 'circle';

export type SkeletonProps = {
  width?: number | `${number}%` | undefined;
  height?: number | undefined;
  /** Corner treatment. Defaults to `text`. */
  shape?: SkeletonShape | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  text: 'rounded-sm',
  rect: 'rounded-control',
  circle: 'rounded-full',
};

/**
 * `Skeleton` -- loading placeholder in the shape of the content it stands
 * for: a `surface-muted` block with a subtle 1.2s opacity pulse (`.skeleton`
 * in `hosts.css`) that stops under reduced motion. The radius comes from
 * `shape`, never a length: `text` lines (`rounded-sm`), `rect` media and
 * cards (`rounded-control`), `circle` avatars (`rounded-full`).
 *
 * `SkeletonContent` draws the four content shapes a screen waits on, so a
 * loading list looks like the list it becomes:
 *   - `rows`       -- a panel of two-line rows (settings, records).
 *   - `avatarText` -- a panel of rows led by an avatar (people, inboxes).
 *   - `tiles`      -- a two-column grid of square tiles (games, packs).
 *   - `board`      -- a square board between two player bars (a game).
 *
 * The placeholders are hidden from assistive technology; the group is one
 * polite `status` named "Loading" (or `label`). `LoadingState` (the Spinner)
 * stays the wait for work with no known shape.
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} />
 * <Skeleton width={48} height={48} shape="circle" />
 * <SkeletonContent variant="avatarText" count={4} />
 * ```
 */
export function Skeleton(props: SkeletonProps): JSX.Element {
  return (
    <div
      class="box skeleton shrink-0 overflow-hidden bg-surface-muted"
      classList={{ [SHAPE_CLASS[props.shape ?? 'text']]: true }}
      {...dataAttrs({
        component: 'Skeleton',
        shape: props.shape ?? 'text',
        ...props.dataSet,
      })}
      style={{
        width: cssPx(props.width ?? '100%'),
        height: cssPx(props.height ?? 16),
      }}
      aria-hidden="true"
    />
  );
}

export type SkeletonContentVariant = 'rows' | 'avatarText' | 'tiles' | 'board';

/** How many rows or tiles a skeleton draws. */
export type SkeletonCount = 1 | 2 | 3 | 4 | 5 | 6;

export type SkeletonContentProps = {
  variant: SkeletonContentVariant;
  /** Rows (`rows`, `avatarText`) or tiles (`tiles`). Default 3 rows, 4 tiles. */
  count?: SkeletonCount | undefined;
  /** Announced while waiting. Defaults to "Loading". */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const DEFAULT_COUNT: Record<SkeletonContentVariant, SkeletonCount> = {
  rows: 3,
  avatarText: 3,
  tiles: 4,
  board: 1,
};

/** Line lengths alternate so a column of rows does not read as a grid. */
const TITLE_WIDTHS = ['60%', '45%', '70%'] as const;
const LINE_HEIGHT = 14;
const CAPTION_HEIGHT = 12;
const AVATAR_SIZE = 40;
const PLAYER_AVATAR_SIZE = 32;

function indices(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function SkeletonLines(props: { index: number }): JSX.Element {
  return (
    <div class="box flex-1 min-w-0 gap-2">
      <Skeleton
        width={TITLE_WIDTHS[props.index % TITLE_WIDTHS.length]}
        height={LINE_HEIGHT}
      />
      <Skeleton width="35%" height={CAPTION_HEIGHT} />
    </div>
  );
}

function SkeletonRows(props: { count: number; avatar: boolean }): JSX.Element {
  return (
    <div class="panel" data-slot="rows">
      <For each={indices(props.count)}>
        {(index) => (
          <div class="box panelItem flex-row items-center gap-3 min-h-14 px-4 py-3">
            <Show when={props.avatar}>
              <Skeleton
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                shape="circle"
              />
            </Show>
            <SkeletonLines index={index} />
          </div>
        )}
      </For>
    </div>
  );
}

function SkeletonTiles(props: { count: number }): JSX.Element {
  return (
    <div class="grid grid-cols-2 gap-3" data-slot="tiles">
      <For each={indices(props.count)}>
        {() => (
          <div class="box gap-2">
            <div class="box skeleton aspect-square w-full rounded-card bg-surface-muted" />
            <Skeleton width="60%" height={LINE_HEIGHT} />
          </div>
        )}
      </For>
    </div>
  );
}

function SkeletonPlayerBar(): JSX.Element {
  return (
    <div class="box flex-row items-center gap-3">
      <Skeleton
        width={PLAYER_AVATAR_SIZE}
        height={PLAYER_AVATAR_SIZE}
        shape="circle"
      />
      <Skeleton width="40%" height={LINE_HEIGHT} />
    </div>
  );
}

function SkeletonBoard(): JSX.Element {
  return (
    <div class="box gap-3" data-slot="board">
      <SkeletonPlayerBar />
      <div class="box skeleton aspect-square w-full rounded-card bg-surface-muted" />
      <SkeletonPlayerBar />
    </div>
  );
}

/** A loading placeholder shaped like rows, people, tiles or a game board. */
export function SkeletonContent(props: SkeletonContentProps): JSX.Element {
  const { t } = useLingui();
  const count = (): number => props.count ?? DEFAULT_COUNT[props.variant];
  return (
    <div
      class="box w-full min-w-0"
      role="status"
      aria-busy="true"
      aria-label={props.label ?? t`Loading`}
      {...dataAttrs({
        component: 'SkeletonContent',
        variant: props.variant,
        ...props.dataSet,
      })}
    >
      <div class="box w-full min-w-0" aria-hidden="true">
        <Switch>
          <Match when={props.variant === 'rows'}>
            <SkeletonRows count={count()} avatar={false} />
          </Match>
          <Match when={props.variant === 'avatarText'}>
            <SkeletonRows count={count()} avatar />
          </Match>
          <Match when={props.variant === 'tiles'}>
            <SkeletonTiles count={count()} />
          </Match>
          <Match when={props.variant === 'board'}>
            <SkeletonBoard />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
