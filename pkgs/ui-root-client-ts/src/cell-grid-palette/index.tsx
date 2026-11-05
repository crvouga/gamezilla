/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  nextRovingIndex,
  rovingTabStop,
} from '@pkgs/ui-root-shared-ts/roving-focus';
import { createUniqueId, For, type JSX } from 'solid-js';
import board from '../cell-grid-board/cell-grid-board.module.css';
import type {
  CellGridBoardProps,
  CellGridCell,
  CellGridTone,
} from '../cell-grid-board/index';
import styles from './cell-grid-palette.module.css';

/** One tool: its name and the square it lays down, drawn as the board draws it. */
export type CellGridPaletteItem<K extends string = string> = {
  readonly key: K;
  /** The tool's name, under its swatch; also its accessible name. */
  readonly label: string;
  /** The swatch's tone, glyph and identity, as a board cell's. */
  readonly tone: CellGridTone;
  readonly glyph?: string | undefined;
  readonly identity?: CellGridCell['identity'];
  /** Call-site id for the tool, shipped as `data-testid`. */
  readonly testid?: string | undefined;
};

export type CellGridPaletteProps<K extends string = string> = {
  /** Names the group, shown above it (`Tool`). */
  readonly label: string;
  /** The board's palette, so each swatch matches the board it paints. */
  readonly boardTheme?: CellGridBoardProps['boardTheme'];
  readonly items: readonly CellGridPaletteItem<K>[];
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

/** Arrow keys move the chosen tool, wrapping (WAI-ARIA radio group). */
function onToolKeyDown(event: KeyboardEvent): void {
  const tool = event.currentTarget;
  if (!(tool instanceof HTMLElement)) return;
  const group = tool.closest('[role="radiogroup"]');
  if (group === null) return;
  const items = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  );
  const current = items.findIndex((item) => item === document.activeElement);
  if (current < 0) return;
  const next = nextRovingIndex({
    key: event.key,
    current,
    disabled: items.map((item) => item.disabled),
    orientation: 'both',
    homeEnd: false,
  });
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
  items[next]?.click();
}

/** A one-square board: the tool's square exactly as the board draws it. */
function Swatch(props: {
  item: CellGridPaletteItem;
  boardTheme: CellGridPaletteProps['boardTheme'];
}): JSX.Element {
  return (
    <span
      class={`${board['board']} ${styles['swatch']}`}
      data-board-theme={props.boardTheme ?? 'battleship'}
      style={{ '--cell-grid-columns': 1 }}
      aria-hidden="true"
    >
      <span
        class={board['cell']}
        data-tone={props.item.tone}
        data-identity={props.item.identity}
      >
        <span class={board['glyph']}>{props.item.glyph ?? ''}</span>
      </span>
    </span>
  );
}

/**
 * `CellGridPalette` -- the tools of a grid editor as one segmented picker.
 *
 * Each tool is a tile: a swatch of the square it lays down, drawn by the
 * board's own palette (a wall as the board's wall, a crate as its crate),
 * over the tool's name. One tool is chosen at a time (`role="radiogroup"`):
 * the chosen tile takes the selection tint and edge, as a segmented
 * control's chosen segment does. Measured on its own width: from 400px the
 * tiles sit four to a row with their names; narrower (a phone) they are
 * one row of swatches, each named for a listener, and the chosen tool's
 * name follows the group's label, so the palette costs the board one row.
 * Keyboard: one tab stop; the arrow keys choose the next or previous
 * tool, wrapping.
 *
 * @example
 * ```tsx
 * <CellGridPalette label="Tool" boardTheme="sokoban" selected="wall"
 *   onSelect={setTool} items={[
 *     { key: 'wall', label: 'Wall', tone: 'occupied' },
 *     { key: 'crate', label: 'Crate', tone: 'open', glyph: '▢', identity: 'one' },
 *   ]} />
 * ```
 */
export function CellGridPalette<K extends string = string>(
  props: CellGridPaletteProps<K>
): JSX.Element {
  const id = createUniqueId();
  const tabStop = (): K | undefined => {
    const index = rovingTabStop(
      props.items.findIndex((item) => item.key === props.selected),
      props.items.map(() => props.disabled === true)
    );
    return index === null ? undefined : props.items[index]?.key;
  };
  return (
    <div
      class={styles['palette']}
      {...dataAttrs({ component: 'CellGridPalette' })}
    >
      <span class={`text textCaption text-text-secondary ${styles['label']}`}>
        <span id={id}>{props.label}</span>
        {/* Narrow, the tiles are swatches alone: the chosen tool's name is
            said here, as a sighted reader's cue; a listener hears each
            tool's own name and its checked state. */}
        <span class={styles['chosen']} aria-hidden="true">
          {props.items.find((item) => item.key === props.selected)?.label}
        </span>
      </span>
      <div
        class={styles['track']}
        style={{ '--cell-grid-palette-count': props.items.length }}
        role="radiogroup"
        aria-labelledby={id}
        aria-disabled={props.disabled === true ? true : undefined}
        {...dataAttrs({ ...props.dataSet })}
      >
        <For each={props.items}>
          {(item) => (
            <button
              type="button"
              class={`clickable ${styles['tool']}`}
              classList={{ clickableTint: item.key !== props.selected }}
              role="radio"
              aria-checked={item.key === props.selected}
              data-key={item.key}
              data-testid={item.testid}
              tabIndex={tabStop() === item.key ? 0 : -1}
              disabled={props.disabled === true}
              onKeyDown={onToolKeyDown}
              onClick={() => {
                if (item.key !== props.selected) props.onSelect(item.key);
              }}
            >
              <Swatch item={item} boardTheme={props.boardTheme} />
              <span class={`text textCaption ${styles['name']}`}>
                {item.label}
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
