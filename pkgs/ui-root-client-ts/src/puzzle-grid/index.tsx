/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { For, Show } from 'solid-js';
import { CheckIcon } from '../icons';
import styles from './puzzle-grid.module.css';

/**
 * `solved` carries a check, `current` is the one puzzle to play next, and
 * `open` is any other puzzle the person may choose.
 */
export type PuzzleGridTileState = 'solved' | 'current' | 'open';

export type PuzzleGridTile = {
  readonly key: string;
  /** Its place in the sequence, from 1: the tile's face. */
  readonly number: number;
  /** What a listener hears for the tile (`Dock 04, solved`). */
  readonly label: string;
  readonly state: PuzzleGridTileState;
  readonly onPress: () => void;
  readonly dataSet?: ComponentDataSet | undefined;
};

export type PuzzleGridProps = {
  /** Names the grid for assistive technology (`Puzzles in Warehouse basics`). */
  readonly label: string;
  /** In sequence order; the grid keeps it left to right, then down. */
  readonly tiles: readonly PuzzleGridTile[];
  readonly dataSet?: ComponentDataSet | undefined;
};

/**
 * `PuzzleGrid` -- the puzzles of an ordered pack as numbered tiles, many to
 * a row, so a long pack reads at a glance instead of down one tall list. A
 * solved puzzle shows a check behind its number and the next one to play is
 * filled, so where the person stands is the first thing seen. Each tile is
 * one button named by its `label`; tiles wrap to the width they have.
 */
export function PuzzleGrid(props: PuzzleGridProps): JSX.Element {
  return (
    <ul
      class={styles['grid']}
      aria-label={props.label}
      {...dataAttrs({ component: 'PuzzleGrid', ...props.dataSet })}
    >
      <For keyed={false} each={props.tiles}>
        {(tile) => (
          <li class={styles['item']}>
            <SdkButton
              type="button"
              class={`clickable clickableTint ${styles['tile']}`}
              aria-label={tile().label}
              aria-current={tile().state === 'current' ? 'true' : undefined}
              onClick={() => tile().onPress()}
              {...dataAttrs({
                component: 'PuzzleGridTile',
                state: tile().state,
                ...tile().dataSet,
              })}
            >
              <Show when={tile().state === 'solved'}>
                <span class={styles['check']} aria-hidden="true">
                  <CheckIcon size={16} color="currentColor" strokeWidth={3} />
                </span>
              </Show>
              <span class={styles['number']} aria-hidden="true">
                {tile().number}
              </span>
            </SdkButton>
          </li>
        )}
      </For>
    </ul>
  );
}
