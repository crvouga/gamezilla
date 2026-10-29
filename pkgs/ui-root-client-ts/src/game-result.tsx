/** @jsxImportSource solid-js */
/**
 * Game over: how it ended, who placed where, and the numbers of a solo run.
 *
 * - `GameResultHeadline`: the outcome in the `displayXl` style ("You win",
 *   "You came 2nd", "Erin wins") and an optional caption line (the reason).
 * - `GameStandings`: one to eight players in finishing order, as an ordered
 *   list in a panel. Each row: the place ("1st", supplied or computed from
 *   `place`), avatar, name (truncated), score in the `stat` style and an
 *   optional readiness tag ("Ready", "Not ready"). The viewer's row is the
 *   soft blue and `aria-current`.
 * - `GameStatTiles`: a grid of `GameStat` tiles for a solo game's numbers.
 *
 * Every word is the caller's.
 */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { Avatar } from './avatar';
import { Badge } from './badge';
import { formatOrdinal } from './game-ordinal';
import { GameStat } from './game-stat';
import { VisuallyHidden } from './visually-hidden';

export function GameResultHeadline(props: {
  title: JSX.Element;
  /** One line under the headline: the reason, a rating change. */
  caption?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <div
      class="box gap-2 min-w-0"
      {...dataAttrs({ component: 'GameResultHeadline', ...props.dataSet })}
    >
      <h2 class="text textDisplayXl">{props.title}</h2>
      <Show when={props.caption}>
        <p class="text textBody text-text-secondary">{props.caption}</p>
      </Show>
    </div>
  );
}

/** Whether a player is ready for the next round, as a word. */
export type GameStandingReadiness = { label: JSX.Element; ready: boolean };

/** One player's finish. */
export type GameStandingRow = {
  /** Stable key (the seat). */
  id: string;
  /** 1 for the winner; equal places tie. */
  place: number;
  /** The place as words; computed from `place` (`2nd`) when absent. */
  ordinal?: string | undefined;
  name: string;
  /** The player's `Avatar` (32px). Defaults to the person placeholder. */
  avatar?: JSX.Element;
  score?: string | null | undefined;
  readiness?: GameStandingReadiness | null | undefined;
  /** The viewer's own row. */
  you?: boolean | undefined;
  /** Shipped as `data-testid` on the row. */
  testId?: string | undefined;
};

export type GameStandingsProps = {
  /** One to eight rows; shown in order of `place`. */
  rows: readonly GameStandingRow[];
  /** Names the list (`Standings`). */
  'aria-label': string;
  /** What the score is, for a listener (`Points`). */
  scoreLabel?: string | null | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const STANDING_AVATAR_SIZE = 32;

function StandingScore(props: {
  score: string;
  label: string | null | undefined;
}): JSX.Element {
  return (
    <span class="text textStat textNumeral shrink-0 whitespace-nowrap">
      <Show when={props.label}>
        {(label) => <VisuallyHidden>{`${label()} `}</VisuallyHidden>}
      </Show>
      {props.score}
    </span>
  );
}

function StandingRow(props: {
  row: GameStandingRow;
  scoreLabel: string | null | undefined;
}): JSX.Element {
  const { i18n } = useLingui();
  const you = (): boolean => props.row.you === true;
  return (
    <li
      class="panelItem"
      aria-current={you() ? 'true' : undefined}
      data-component={componentId('GameStandingRow')}
      data-place={String(props.row.place)}
      data-you={you() ? 'true' : undefined}
      data-testid={props.row.testId}
    >
      <div
        class="box flex-row items-center gap-3 px-4 py-2 min-h-14"
        classList={{ 'bg-tint-subtle': you() }}
      >
        <span
          class="text textLabel textNumeral shrink-0 min-w-10"
          classList={{ 'text-on-primary-soft': you() }}
        >
          {props.row.ordinal ?? formatOrdinal(props.row.place, i18n().locale)}
        </span>
        <span class="box shrink-0" aria-hidden="true">
          <Show
            when={props.row.avatar}
            fallback={<Avatar size={STANDING_AVATAR_SIZE} />}
          >
            {props.row.avatar}
          </Show>
        </span>
        <span
          class="text textLabel flex-1 min-w-0 truncate"
          classList={{ 'text-on-primary-soft': you() }}
        >
          {props.row.name}
        </span>
        <Show when={props.row.readiness}>
          {(readiness) => (
            <Badge
              label={readiness().label}
              intent={readiness().ready ? 'success' : 'neutral'}
            />
          )}
        </Show>
        <Show when={props.row.score}>
          {(score) => (
            <StandingScore score={score()} label={props.scoreLabel} />
          )}
        </Show>
      </div>
    </li>
  );
}

export function GameStandings(props: GameStandingsProps): JSX.Element {
  const rows = createMemo(() =>
    [...props.rows].sort((a, b) => a.place - b.place)
  );
  return (
    <ol
      class="panel"
      aria-label={props['aria-label']}
      {...dataAttrs({ component: 'GameStandings', ...props.dataSet })}
    >
      <For each={rows()}>
        {(row) => <StandingRow row={row} scoreLabel={props.scoreLabel} />}
      </For>
    </ol>
  );
}

/** One number of a solo run. */
export type GameStatTile = {
  id: string;
  label: JSX.Element;
  value: JSX.Element;
  detail?: JSX.Element | undefined;
  /** `data-*` for the tile (a test id, the value as automation reads it). */
  dataSet?: ComponentDataSet | undefined;
};

export function GameStatTiles(props: {
  tiles: readonly GameStatTile[];
  /** Names the group of numbers. */
  'aria-label'?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <ul
      class="grid grid-cols-2 sm:grid-cols-3 gap-2"
      aria-label={props['aria-label']}
      {...dataAttrs({ component: 'GameStatTiles', ...props.dataSet })}
    >
      <For each={props.tiles}>
        {(tile) => (
          <li
            class="box rounded-card border border-border bg-surface p-4 min-w-0"
            data-stat={tile.id}
            {...dataAttrs(tile.dataSet)}
          >
            <GameStat
              label={tile.label}
              value={tile.value}
              detail={tile.detail}
            />
          </li>
        )}
      </For>
    </ul>
  );
}
