/**
 * Coordinate gestures as PointerEvents. Boards / canvases listen for
 * `pointerdown` → `pointermove` → `pointerup` and map `clientX/Y` against
 * their own `getBoundingClientRect()`, which {@link ensureElementLayout}
 * synthesizes when the host cannot lay out.
 */

import type { TapPosition } from '@pkgs/ui-testing/driver/driver';
import {
  ensureElementLayout,
  type LayoutProvider,
  pointFromRatio,
} from './dom-layout';

type Point = { readonly x: number; readonly y: number };

type PointerPhase = 'down' | 'move' | 'up';

const POINTER_ID = 1;

function pointerInit(phase: PointerPhase, point: Point): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: POINTER_ID,
    pointerType: 'mouse',
    isPrimary: true,
    button: phase === 'move' ? -1 : 0,
    buttons: phase === 'up' ? 0 : 1,
    clientX: point.x,
    clientY: point.y,
    screenX: point.x,
    screenY: point.y,
  };
}

function dispatchPointer(
  element: Element,
  phase: PointerPhase,
  point: Point
): void {
  const init = pointerInit(phase, point);
  element.dispatchEvent(new PointerEvent(`pointer${phase}`, init));
  const mouseType =
    phase === 'down' ? 'mousedown' : phase === 'up' ? 'mouseup' : 'mousemove';
  element.dispatchEvent(new MouseEvent(mouseType, init));
}

function dispatchClick(element: Element, point: Point): void {
  element.dispatchEvent(new MouseEvent('click', pointerInit('up', point)));
}

/** Press + release at a relative position, followed by `click`. */
export function fireTapAt(
  element: Element,
  position: TapPosition,
  provider: LayoutProvider
): void {
  const layout = ensureElementLayout(element, provider);
  const point = pointFromRatio(layout, position);
  dispatchPointer(element, 'down', point);
  dispatchPointer(element, 'up', point);
  dispatchClick(element, point);
}

/** Press at `from`, move through the midpoint, release at `to`. */
export function fireDrag(
  element: Element,
  from: TapPosition,
  to: TapPosition,
  provider: LayoutProvider
): void {
  const layout = ensureElementLayout(element, provider);
  const start = pointFromRatio(layout, from);
  const end = pointFromRatio(layout, to);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  dispatchPointer(element, 'down', start);
  dispatchPointer(element, 'move', mid);
  dispatchPointer(element, 'move', end);
  dispatchPointer(element, 'up', end);
}
