/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';
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

/**
 * `md` 40px beside a row's title; `lg` 56px beside a game's name; `xl`
 * 96px heading a game's own menu on a wide screen; `cover` fills the box
 * it is given, its board centred on the board's own colour, for the face
 * of a game's card. The box sets the shape and the corners.
 */
export type GameTileSize = 'md' | 'lg' | 'xl' | 'cover';

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
      <ellipse class={styles['shade']} cx="27" cy="23" rx="7" ry="1.8" />
      <g class={styles['c4']}>
        <path d="M20 8h3v2h2V8h3v2h2V8h3v5l-2.5 2 .5 5 2 1v2H20v-2l2-1 .5-5-2.5-2z" />
        <path class={styles['glint']} d="M21 9h1v3h-1zm3 6h1l-.5 4H23z" />
      </g>
      <ellipse class={styles['shade']} cx="13" cy="33" rx="7" ry="1.8" />
      <g class={styles['c3']}>
        <circle cx="12" cy="21" r="3.9" />
        <path d="M9.5 24h5l-1 1.8c0 2 1.2 3.4 3 4l1.2 1v2H6.3v-2l1.2-1c1.8-.6 3-2 3-4z" />
      </g>
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
          <g transform={`translate(${8 + c * 12} ${8 + r * 12})`}>
            <circle class={styles['shade']} cy="1" r="5.25" />
            <circle class={styles[tone]} r="4.75" />
            <path
              class={tone === 'c4' ? styles['socket'] : styles['glintLine']}
              d="M-3 .2a3.2 3.2 0 0 1 3.2-3.2"
            />
          </g>
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
      <path class={styles['shade']} d="M4 27q7-6 14-6h12l4 4-5 4H10z" />
      <path class={styles['c4']} d="M4 25q7-6 14-6h12l4 4-5 4H10z" />
      <path class={styles['glint']} d="M6 24.5q7-4.5 13-4.5h10l2 1.5H18z" />
      <circle class={styles['c1']} cx="15" cy="25" r="2.25" />
      <circle class={styles['c2']} cx="30" cy="9" r="3" />
    </>
  );
}

function Cards(): JSX.Element {
  return (
    <>
      <rect
        class={styles['underCard']}
        x="5"
        y="9"
        width="15"
        height="21"
        rx="2"
        transform="rotate(-14 16.5 19.5)"
      />
      <path class={styles['c1']} d="m10 14 2.5-3 2.5 3-2.5 3z" />
      <rect
        class={styles['shade']}
        x="16"
        y="12"
        width="16"
        height="22"
        rx="2"
        transform="rotate(10 24.5 20.5)"
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
      <rect
        class={styles['shade']}
        x="4"
        y="15"
        width="14"
        height="14"
        rx="2"
      />
      <rect
        class={styles['shade']}
        x="22"
        y="15"
        width="14"
        height="14"
        rx="2"
      />
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
      <path class={styles['c3']} d="m8 14 7-6h16l-5 6z" />
      <path class={styles['glint']} d="m8 14 7-6h16l-5 6z" />
      <path class={styles['c3']} d="m26 14 5-6v17l-5 7z" />
      <path class={styles['shade']} d="m26 14 5-6v17l-5 7z" />
      <rect class={styles['c3']} x="8" y="14" width="18" height="18" rx="1" />
      <path
        class={styles['cut']}
        d="M11 17l12 12M23 17L11 29"
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
      <ellipse class={styles['shade']} cx="26.5" cy="18.5" rx="3.5" ry="1.5" />
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
  const size = (): GameTileSize => props.size ?? 'md';
  return (
    <span
      class={[
        `${styles['tile']}`,
        {
          'rounded-control': size() === 'md' || size() === 'lg',
          'rounded-card': size() === 'xl',
        },
      ]}
      data-motif={props.motif}
      data-size={size()}
      aria-hidden="true"
      {...dataAttrs({ component: 'GameTile', ...props.dataSet })}
    >
      <span class={styles['miniature']}>
        <svg viewBox="0 0 40 40" class={styles['art']}>
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
