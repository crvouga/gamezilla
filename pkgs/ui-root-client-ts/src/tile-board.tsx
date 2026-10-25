/** @jsxImportSource solid-js */
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, Index, type JSX, Show } from 'solid-js';
import styles from './tile-board.module.css';

/** `solid` blocks, `open` is walkable ground, `none` is no part of the board. */
export type TileBoardTerrain = 'open' | 'solid' | 'none';
export type TileBoardTile = {
  readonly terrain: TileBoardTerrain;
  /** A ring drawn on the tile: a place something belongs. */
  readonly marked: boolean;
  /** The tile's whole accessible name: where it is and what is on it. */
  readonly label: string;
};
/** What stands on a tile; each tone also differs by its glyph. */
export type TileBoardPiece = {
  /** Keep each piece at the same array position as it moves, so it glides. */
  readonly id: string;
  readonly column: number;
  readonly row: number;
  readonly glyph: string;
  readonly tone: 'actor' | 'object' | 'settled';
};
export type TileBoardDirection = 'up' | 'down' | 'left' | 'right';
export type TileBoardProps = {
  readonly label: string;
  readonly testId: string;
  readonly columns: number;
  readonly rows: number;
  /** Row-major, one per column and row. */
  readonly tiles: readonly TileBoardTile[];
  readonly pieces: readonly TileBoardPiece[];
  readonly disabled?: boolean | undefined;
  readonly describedBy?: string | undefined;
  /** Arrow keys or W A S D while the board has focus, or a swipe across it. */
  readonly onDirection?: ((direction: TileBoardDirection) => void) | undefined;
  /** A tap on the tile at this row-major index. */
  readonly onTile?: ((index: number) => void) | undefined;
};

const KEYS: Readonly<Record<string, TileBoardDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};
/** Travel shorter than this is a tap, longer a swipe (CSS px). */
const SWIPE_PX = 24;

/** A swipe's direction from its travel, or `null` for a tap. */
export function tileBoardSwipe(
  dx: number,
  dy: number
): TileBoardDirection | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * A rectangular board of tiles with pieces standing on them, steered as one
 * focus stop: arrow keys or W A S D give a direction, a swipe gives its
 * direction and a tap names a tile. Pieces glide between tiles unless the
 * person prefers reduced motion; logic never waits for the glide.
 */
export function TileBoard(props: TileBoardProps): JSX.Element {
  let origin: { x: number; y: number } | null = null;
  const tileAt = (event: PointerEvent, board: HTMLElement): number | null => {
    const box = board.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    const column = Math.floor(
      ((event.clientX - box.left) / box.width) * props.columns
    );
    const row = Math.floor(
      ((event.clientY - box.top) / box.height) * props.rows
    );
    return column < 0 || row < 0 || column >= props.columns || row >= props.rows
      ? null
      : row * props.columns + column;
  };
  const release = (event: PointerEvent): void => {
    const from = origin;
    origin = null;
    if (from === null || props.disabled === true) return;
    const swipe = tileBoardSwipe(
      event.clientX - from.x,
      event.clientY - from.y
    );
    if (swipe !== null) return props.onDirection?.(swipe);
    const index = tileAt(event, event.currentTarget as HTMLElement);
    if (index !== null) props.onTile?.(index);
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the focused board owns the direction keys that steer it
    <div
      class={styles['board']}
      {...dataAttrs({ component: 'TileBoard' })}
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the board itself takes focus so the direction keys reach it
      tabIndex={0}
      aria-label={props.label}
      aria-describedby={props.describedBy}
      aria-disabled={props.disabled === true}
      data-testid={props.testId}
      data-disabled={String(props.disabled === true)}
      style={{
        '--tile-board-columns': props.columns,
        '--tile-board-rows': props.rows,
      }}
      onKeyDown={(event) => {
        const direction = KEYS[event.key];
        if (direction === undefined || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        if (props.disabled !== true) props.onDirection?.(direction);
      }}
      onPointerDown={(event) => {
        origin = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={release}
      onPointerCancel={() => {
        origin = null;
      }}
    >
      <div class={styles['tiles']}>
        <For each={props.tiles}>
          {(tile, index) => (
            <span
              class={styles['tile']}
              role="img"
              aria-label={tile.label}
              data-terrain={tile.terrain}
              data-marked={String(tile.marked)}
              data-testid={`${props.testId}-tile-${index()}`}
            >
              <Show when={tile.marked}>
                <span class={styles['mark']} aria-hidden="true" />
              </Show>
            </span>
          )}
        </For>
      </div>
      <div class={styles['pieces']} aria-hidden="true">
        {/* By position: a piece keeps its element as it moves, so it glides. */}
        <Index each={props.pieces}>
          {(piece) => (
            <span
              class={styles['piece']}
              data-tone={piece().tone}
              data-piece={piece().id}
              style={{
                transform: `translate(${piece().column * 100}%, ${piece().row * 100}%)`,
              }}
            >
              {piece().glyph}
            </span>
          )}
        </Index>
      </div>
    </div>
  );
}
