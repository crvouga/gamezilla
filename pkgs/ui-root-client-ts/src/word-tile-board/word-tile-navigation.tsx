import { t } from '@lingui/core/macro';
import type { JSX } from '@solidjs/web';
import { Button } from '../button/index';
import { StackHorizontal } from '../stack/index';

import { bindWordPointers, type Contact } from './word-tile-pointers';

function middle(a: Contact, b: Contact): Contact {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const distance = (a: Contact, b: Contact) => Math.hypot(a.x - b.x, a.y - b.y);

/** Scale the real grid's layout inside its native scrolling viewport. Browser
 * hit testing, sticky coordinates, and scrollbar clamping share that layout. */
export function bindWordNavigation(
  viewport: HTMLElement,
  board: HTMLElement,
  changed: (custom: boolean) => void
) {
  let scale = 1;
  let baseWidth = 0;
  const zoom = (from: Contact, to: Contact, ratio: number) => {
    const before = board.getBoundingClientRect();
    if (!baseWidth) {
      baseWidth = before.width;
      viewport.style.height = `${viewport.getBoundingClientRect().height}px`;
      board.style.width = `${baseWidth}px`;
    }
    const min = Math.min(
      1,
      viewport.clientWidth / baseWidth,
      viewport.clientHeight / (before.height / scale)
    );
    const next = Math.max(min, Math.min(3, scale * ratio));
    const growth = next / scale;
    scale = next;
    board.style.zoom = String(next);
    const after = board.getBoundingClientRect();
    viewport.scrollLeft += after.left + (from.x - before.left) * growth - to.x;
    viewport.scrollTop += after.top + (from.y - before.top) * growth - to.y;
    changed(true);
  };
  const reset = () => {
    scale = 1;
    baseWidth = 0;
    board.style.removeProperty('zoom');
    board.style.removeProperty('width');
    viewport.style.removeProperty('height');
    changed(false);
  };
  const stop = bindWordPointers(viewport, () => ({
    allowPinch: true,
    move(previous, current) {
      const [a, b] = [...previous.values()];
      const [c, d] = [...current.values()];
      if (!a || !c) return;
      if (b && d)
        zoom(
          middle(a, b),
          middle(c, d),
          distance(c, d) / Math.max(1, distance(a, b))
        );
      else {
        viewport.scrollLeft += a.x - c.x;
        viewport.scrollTop += a.y - c.y;
      }
    },
  }));
  const wheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const anchor = { x: e.clientX, y: e.clientY };
    zoom(
      anchor,
      anchor,
      Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) / 200)
    );
  };
  viewport.addEventListener('wheel', wheel, { passive: false });
  return {
    reset,
    dispose() {
      stop();
      viewport.removeEventListener('wheel', wheel);
    },
  };
}

/** Switch between the whole board and precise scrollable cells, keeping navigation guidance visible. */
export function WordTileViewControls(props: {
  enlarged: boolean;
  onChange: (enlarged: boolean) => void;
}): JSX.Element {
  return (
    <>
      <StackHorizontal gap="xs" wrap dataSet={{ 'view-controls': 'true' }}>
        <Button
          title={props.enlarged ? t`Fit` : t`Fit board`}
          aria-label={t`Fit board`}
          size={props.enlarged ? 'sm' : 'md'}
          variant={props.enlarged ? 'outline' : 'solid'}
          aria-pressed={!props.enlarged}
          onClick={() => props.onChange(false)}
        />
        <Button
          title={props.enlarged ? t`Enlarge` : t`Enlarge board`}
          aria-label={t`Enlarge board`}
          size={props.enlarged ? 'sm' : 'md'}
          variant={props.enlarged ? 'solid' : 'outline'}
          aria-pressed={props.enlarged}
          onClick={() => props.onChange(true)}
        />
      </StackHorizontal>
    </>
  );
}
