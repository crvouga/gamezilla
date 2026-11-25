import {
  bindWordPointers,
  type Contact,
} from '../word-tile-board/word-tile-pointers';
import styles from './tile-rack.module.css';

export type RackPlacement = {
  readonly boardId: string;
  readonly place: (tile: string, square: string) => void;
};

/** Resolve the drop against the painted square, after native scroll and zoom. */
export function bindRackDrag(
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
