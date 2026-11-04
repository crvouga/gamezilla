/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Match, Switch } from 'solid-js';
import styles from './game-tile.module.css';

/**
 * The miniature a game is recognised by, named for what is drawn (never for
 * a game): a checkered board, a frame of dropped discs, a fleet on a grid, a
 * fan of cards, a board with walls, letter tiles, a crate on masonry,
 * linked paths, a court with paddles, light trails. Each paints with the
 * playing-surface colors of the board it shows.
 */
export type GameTileMotif =
  | 'checkered'
  | 'discs'
  | 'fleet'
  | 'cards'
  | 'walls'
  | 'letters'
  | 'crates'
  | 'paths'
  | 'court'
  | 'trails';

/** Every motif, in a stable order (stories, conformance). */
export const GAME_TILE_MOTIFS: readonly GameTileMotif[] = [
  'checkered',
  'discs',
  'fleet',
  'cards',
  'walls',
  'letters',
  'crates',
  'paths',
  'court',
  'trails',
];

/** `md` 40px beside a row's title; `lg` 56px above a game's own choices. */
export type GameTileSize = 'md' | 'lg';

export type GameTileProps = {
  motif: GameTileMotif;
  /** Defaults to `md`. */
  size?: GameTileSize | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const CELLS = [0, 1, 2, 3] as const;

function Checkered(): JSX.Element {
  return (
    <>
      {CELLS.flatMap((row) =>
        CELLS.map((col) => (
          <rect
            class={(row + col) % 2 === 0 ? styles['c1'] : styles['c2']}
            x={col * 10}
            y={row * 10}
            width="10"
            height="10"
          />
        ))
      )}
      <circle class={styles['c3']} cx="25" cy="15" r="3.5" />
      <circle class={styles['c4']} cx="15" cy="25" r="3.5" />
    </>
  );
}

const DISCS: readonly (readonly string[])[] = [
  ['c4', 'c4', 'c4'],
  ['c4', 'c2', 'c4'],
  ['c1', 'c2', 'c1'],
];

function Discs(): JSX.Element {
  return (
    <>
      {DISCS.flatMap((row, r) =>
        row.map((tone, c) => (
          <circle
            class={styles[tone]}
            cx={8 + c * 12}
            cy={8 + r * 12}
            r="4.75"
          />
        ))
      )}
    </>
  );
}

function Fleet(): JSX.Element {
  return (
    <>
      {CELLS.flatMap((row) =>
        CELLS.map((col) => (
          <circle
            class={styles['c3']}
            cx={5 + col * 10}
            cy={5 + row * 10}
            r="1"
          />
        ))
      )}
      <rect class={styles['c4']} x="6" y="21" width="26" height="8" rx="4" />
      <circle class={styles['c1']} cx="15" cy="25" r="2.25" />
      <circle class={styles['c2']} cx="30" cy="9" r="3" />
    </>
  );
}

function Cards(): JSX.Element {
  return (
    <>
      <rect
        class={styles['c3']}
        x="9"
        y="9"
        width="15"
        height="21"
        rx="2"
        transform="rotate(-14 16.5 19.5)"
      />
      <rect
        class={styles['c3']}
        x="17"
        y="10"
        width="15"
        height="21"
        rx="2"
        transform="rotate(10 24.5 20.5)"
      />
      <path
        class={styles['c1']}
        d="M24.6 25.2c-3.6-2.5-5.6-4.4-5.6-6.6 0-1.5 1.1-2.6 2.5-2.6.9 0 1.8.5 2.4 1.3.6-.8 1.5-1.3 2.4-1.3 1.4 0 2.5 1.1 2.5 2.6 0 2.2-2 4.1-5.6 6.6z"
        transform="rotate(10 24.5 20.5)"
      />
    </>
  );
}

function Walls(): JSX.Element {
  return (
    <>
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <rect
            class={styles['c3']}
            x={4 + col * 11}
            y={4 + row * 11}
            width="10"
            height="10"
            rx="1.5"
          />
        ))
      )}
      <rect class={styles['c4']} x="3" y="14" width="22" height="2" rx="1" />
      <rect class={styles['c4']} x="25" y="14" width="2" height="22" rx="1" />
      <circle class={styles['c1']} cx="9" cy="31" r="3.5" />
      <circle class={styles['c2']} cx="20" cy="9" r="3.5" />
    </>
  );
}

function Letters(): JSX.Element {
  return (
    <>
      <rect class={styles['c3']} x="4" y="13" width="14" height="14" rx="2" />
      <rect class={styles['c3']} x="22" y="13" width="14" height="14" rx="2" />
      <rect class={styles['c1']} x="13" y="4" width="14" height="5" rx="1.5" />
      <rect class={styles['c2']} x="13" y="31" width="14" height="5" rx="1.5" />
      <text class={styles['glyph']} x="11" y="24.5" text-anchor="middle">
        A
      </text>
      <text class={styles['glyph']} x="29" y="24.5" text-anchor="middle">
        Z
      </text>
    </>
  );
}

function Crates(): JSX.Element {
  return (
    <>
      <path
        class={styles['line']}
        d="M0 10h40M0 20h40M0 30h40M10 0v10M30 0v10M20 10v10M10 20v10M30 20v10M20 30v10"
        fill="none"
        stroke-width="1"
      />
      <rect class={styles['c3']} x="11" y="11" width="18" height="18" rx="2" />
      <path
        class={styles['cut']}
        d="M14 14l12 12M26 14l-12 12"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
      />
    </>
  );
}

function Paths(): JSX.Element {
  return (
    <>
      <path
        class={styles['s1']}
        d="M9 9v22h12"
        fill="none"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class={styles['s2']}
        d="M31 9H19v11h12v11"
        fill="none"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle class={styles['c1']} cx="9" cy="9" r="4" />
      <circle class={styles['c1']} cx="21" cy="31" r="4" />
      <circle class={styles['c2']} cx="31" cy="9" r="4" />
      <circle class={styles['c2']} cx="31" cy="31" r="4" />
    </>
  );
}

function Court(): JSX.Element {
  return (
    <>
      <path
        class={styles['line']}
        d="M20 3v34"
        fill="none"
        stroke-width="1.5"
        stroke-dasharray="3 3"
      />
      <rect class={styles['c1']} x="5" y="8" width="4" height="12" rx="2" />
      <rect class={styles['c2']} x="31" y="19" width="4" height="12" rx="2" />
      <circle class={styles['c3']} cx="25" cy="15" r="3" />
    </>
  );
}

function Trails(): JSX.Element {
  return (
    <>
      <path
        class={styles['s1']}
        d="M5 33V21h14V8"
        fill="none"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class={styles['s2']}
        d="M35 7v14H26v12"
        fill="none"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="5 2.5"
      />
      <circle class={styles['c1']} cx="19" cy="8" r="3" />
      <circle class={styles['c2']} cx="26" cy="33" r="3" />
    </>
  );
}

/**
 * `GameTile` -- a game's small square picture, beside its name wherever a
 * game is picked: a miniature of its playing surface in that surface's own
 * colors, so a list of games reads at a glance. The card radius; decorative
 * (the name beside it says which game), so hidden from assistive
 * technology. A game chooses its motif; the platform never names a game.
 *
 * @example
 * ```tsx
 * <GameTile motif="discs" />
 * ```
 */
export function GameTile(props: GameTileProps): JSX.Element {
  return (
    <span
      class={`${styles['tile']} rounded-control`}
      data-motif={props.motif}
      data-size={props.size ?? 'md'}
      aria-hidden="true"
      {...dataAttrs({ component: 'GameTile', ...props.dataSet })}
    >
      <svg viewBox="0 0 40 40" class={styles['art']}>
        <rect class={styles['bg']} width="40" height="40" />
        <Switch>
          <Match when={props.motif === 'checkered'}>
            <Checkered />
          </Match>
          <Match when={props.motif === 'discs'}>
            <Discs />
          </Match>
          <Match when={props.motif === 'fleet'}>
            <Fleet />
          </Match>
          <Match when={props.motif === 'cards'}>
            <Cards />
          </Match>
          <Match when={props.motif === 'walls'}>
            <Walls />
          </Match>
          <Match when={props.motif === 'letters'}>
            <Letters />
          </Match>
          <Match when={props.motif === 'crates'}>
            <Crates />
          </Match>
          <Match when={props.motif === 'paths'}>
            <Paths />
          </Match>
          <Match when={props.motif === 'court'}>
            <Court />
          </Match>
          <Match when={props.motif === 'trails'}>
            <Trails />
          </Match>
        </Switch>
      </svg>
    </span>
  );
}

/**
 * `GameTitleLockup` -- a game's name with its `GameTile` before it, for the
 * title that opens the game's own menu. Lives inside the heading, so the
 * heading still reads as the game's name alone (the tile is decorative).
 */
export function GameTitleLockup(props: {
  /** A `GameTile` (`size="lg"` beside a screen title). */
  tile: JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  return (
    <span
      class={styles['lockup']}
      {...dataAttrs({ component: 'GameTitleLockup' })}
    >
      {props.tile}
      <span class={styles['lockupName']}>{props.children}</span>
    </span>
  );
}
