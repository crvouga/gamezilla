import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { For, onSettled } from 'solid-js';
import {
  bindWordPointers,
  type Contact,
} from '../word-tile-board/word-tile-pointers';
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
  readonly placement?: RackPlacement | undefined;
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
  let rack: HTMLDivElement | undefined;
  onSettled(() =>
    rack ? bindRackDrag(rack, () => props.placement) : undefined
  );
  return (
    <div class={styles['frame']}>
      <div
        ref={rack}
        data-drag-enabled={String(props.placement !== undefined)}
        class={styles['rack']}
        role="group"
        aria-label={props.label}
        data-testid={props.testId}
        {...dataAttrs({ component: 'TileRack' })}
      >
        <For each={props.tiles}>
          {(tile) => (
            <SdkButton
              type="button"
              class={styles['tile']}
              data-testid={
                props.tileTestId?.(tile.id) ?? `${props.testId}-${tile.id}`
              }
              data-rack-tile={tile.id}
              data-selected={String(tile.selected)}
              data-placed={String(tile.placed)}
              aria-pressed={tile.selected ? 'true' : 'false'}
              aria-label={tile.label}
              aria-disabled={tile.enabled ? 'false' : 'true'}
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
            </SdkButton>
          )}
        </For>
      </div>
    </div>
  );
}

type RackPlacement = {
  readonly boardId: string;
  readonly place: (tile: string, square: string) => void;
};

/** Resolve the drop against the painted square, after native scroll and zoom. */
function bindRackDrag(
  rack: HTMLElement,
  placement: () => RackPlacement | undefined
) {
  const doc = rack.ownerDocument;
  return bindWordPointers(rack, (event) => {
    const tile = (event.target as Element).closest<HTMLElement>(
      '[data-rack-tile]'
    );
    const binding = placement();
    if (!tile || !binding || tile.getAttribute('aria-disabled') === 'true')
      return undefined;
    const id = tile.dataset['rackTile'];
    if (!id) return undefined;
    let face: HTMLElement | undefined;
    let target: HTMLElement | undefined;
    const find = (p: Contact) => {
      const hit = doc
        .elementFromPoint(p.x, p.y)
        ?.closest<HTMLElement>('[data-cell]');
      if (
        hit?.closest('[data-drop-board]')?.getAttribute('data-drop-board') ===
          binding.boardId &&
        hit.dataset['state'] === 'empty' &&
        hit.getAttribute('aria-disabled') === 'false'
      )
        return hit;
      return undefined;
    };
    const clear = () => {
      target?.removeAttribute('data-drop-target');
      tile.removeAttribute('data-lifted');
      face?.remove();
    };
    return {
      allowPinch: false,
      move(_previous, current) {
        const p = current.get(event.pointerId);
        if (!p) return;
        if (!face) {
          face = doc.createElement('span');
          face.className = styles['floating'] ?? '';
          face.setAttribute('aria-hidden', 'true');
          face.append(
            ...Array.from(tile.children, (part) => part.cloneNode(true))
          );
          face.popover = 'manual';
          rack.append(face);
          face.showPopover();
          tile.setAttribute('data-lifted', 'true');
        }
        face.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        const next = find(p);
        if (target !== next) {
          target?.removeAttribute('data-drop-target');
          next?.setAttribute('data-drop-target', 'true');
          target = next;
        }
      },
      release(p) {
        const square = find(p)?.dataset['cell'];
        clear();
        if (
          square &&
          tile.isConnected &&
          tile.getAttribute('aria-disabled') === 'false'
        )
          placement()?.place(id, square);
      },
      cancel: clear,
    };
  });
}
