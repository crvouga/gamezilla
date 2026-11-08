/** @jsxImportSource solid-js */
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { Index, type JSX, Show } from 'solid-js';
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
/**
 * What stands on a tile, drawn as a token most of a tile wide: `actor` a
 * round figure, `object` a square block, `settled` a block in the place it
 * belongs. Each tone also differs by its shape and its glyph.
 */
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
  /**
   * `compact` (default): tiles of at most 44px. `fill`: the board is the
   * screen's hero, as wide as what holds it (tiles up to 80px) while it
   * still fits the viewport's height, its pieces scaled with the tiles.
   */
  readonly size?: 'compact' | 'fill' | undefined;
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

function createTileBoardInput(props: TileBoardProps) {
  let origin: { x: number; y: number; pointerId: number } | null = null;
  const interactive = () =>
    props.disabled !== true &&
    (props.onDirection !== undefined || props.onTile !== undefined);
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
    if (from === null || from.pointerId !== event.pointerId) return;
    origin = null;
    const board = event.currentTarget as HTMLElement;
    if (board.hasPointerCapture(event.pointerId))
      board.releasePointerCapture(event.pointerId);
    if (!interactive()) return;
    const swipe = tileBoardSwipe(
      event.clientX - from.x,
      event.clientY - from.y
    );
    if (swipe !== null) return props.onDirection?.(swipe);
    const index = tileAt(event, event.currentTarget as HTMLElement);
    if (index !== null) props.onTile?.(index);
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (!interactive() || props.onDirection === undefined) return;
    const direction = KEYS[event.key];
    if (direction === undefined || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    props.onDirection(direction);
  };
  const pointerDown = (event: PointerEvent): void => {
    if (!interactive() || origin !== null || event.button !== 0) return;
    origin = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const cancel = (event: PointerEvent): void => {
    if (origin?.pointerId === event.pointerId) origin = null;
  };
  return { interactive, keyDown, pointerDown, release, cancel };
}

/**
 * A rectangular board of tiles with pieces standing on them, steered as one
 * focus stop: arrow keys or W A S D give a direction, a swipe gives its
 * direction and a tap names a tile. Pieces glide between tiles unless the
 * person prefers reduced motion; logic never waits for the glide.
 */
export function TileBoard(props: TileBoardProps): JSX.Element {
  const input = createTileBoardInput(props);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the focused board owns the direction keys that steer it
    <div
      class={styles['board']}
      {...dataAttrs({ component: 'TileBoard' })}
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the board itself takes focus so the direction keys reach it
      tabIndex={input.interactive() ? 0 : -1}
      aria-label={props.label}
      aria-describedby={props.describedBy}
      aria-disabled={props.disabled === true}
      data-testid={props.testId}
      data-disabled={String(props.disabled === true)}
      data-interactive={String(input.interactive())}
      data-size={props.size ?? 'compact'}
      style={{
        '--tile-board-columns': props.columns,
        '--tile-board-rows': props.rows,
      }}
      onKeyDown={input.keyDown}
      onPointerDown={input.pointerDown}
      onPointerUp={input.release}
      onPointerCancel={input.cancel}
      onLostPointerCapture={input.cancel}
    >
      <div class={styles['tiles']}>
        <Index each={props.tiles}>
          {(tile, index) => (
            <span
              class={styles['tile']}
              role="img"
              aria-label={tile().label}
              data-terrain={tile().terrain}
              data-marked={String(tile().marked)}
              data-testid={`${props.testId}-tile-${index}`}
            >
              <Show when={tile().marked}>
                <span class={styles['mark']} aria-hidden="true" />
              </Show>
            </span>
          )}
        </Index>
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
              {/* The token fills most of its tile, its glyph inside it. */}
              <span class={styles['token']}>{piece().glyph}</span>
            </span>
          )}
        </Index>
      </div>
    </div>
  );
}
