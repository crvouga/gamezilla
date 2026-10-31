import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import styles from './tile-rack.module.css';

export type TileRackTile = {
  readonly id: string;
  /** The letter shown; `''` for a blank not yet given one. */
  readonly letter: string;
  readonly points: number;
  /** Chosen for the next placement or an exchange. */
  readonly selected: boolean;
  /** Already placed on the board in the viewer's candidate. */
  readonly placed: boolean;
  /** Its accessible name, starting with what it shows (`S, 1 point`). */
  readonly label: string;
  readonly enabled: boolean;
};

export type TileRackProps = {
  readonly label: string;
  readonly testId: string;
  readonly tiles: readonly TileRackTile[];
  /** Defaults to `${testId}-${id}`. */
  readonly tileTestId?: ((id: string) => string) | undefined;
  readonly onActivate: (id: string) => void;
};

/**
 * A player's own rack of tiles: one button per tile with its letter and
 * value. A selected tile is raised and a placed one shown as an empty slot
 * (both also said in its label). Tiles stay mounted as the rack is
 * reordered, so focus survives.
 */
export function TileRack(props: TileRackProps): JSX.Element {
  return (
    <div
      class={styles['rack']}
      {...dataAttrs({ component: 'TileRack' })}
      role="group"
      aria-label={props.label}
      data-testid={props.testId}
    >
      <For each={props.tiles}>
        {(tile) => (
          <button
            type="button"
            class={styles['tile']}
            data-testid={
              props.tileTestId?.(tile.id) ?? `${props.testId}-${tile.id}`
            }
            data-selected={String(tile.selected)}
            data-placed={String(tile.placed)}
            aria-pressed={tile.selected}
            aria-label={tile.label}
            aria-disabled={!tile.enabled}
            onClick={() => {
              if (tile.enabled) props.onActivate(tile.id);
            }}
          >
            <span class={styles['letter']} aria-hidden="true">
              {tile.placed ? '' : tile.letter}
            </span>{' '}
            <span class={styles['points']} aria-hidden="true">
              {tile.placed ? '' : tile.points}
            </span>
          </button>
        )}
      </For>
    </div>
  );
}
