/**
 * Coordinate gestures as PointerEvents. Boards / canvases listen for
 * `pointerdown` → `pointermove` → `pointerup` and map `clientX/Y` against
 * their own `getBoundingClientRect()`, which {@link ensureElementLayout}
 * synthesizes when the host cannot lay out.
 */

import type {
  GestureOptions,
  PointerButton,
  TapPosition,
} from '@pkgs/ui-testing-root-shared/driver';
import type { LayoutProvider } from './dom-layout';
import { ensureElementLayout, pointFromRatio } from './dom-layout';

type Point = { readonly x: number; readonly y: number };

type PointerPhase = 'down' | 'move' | 'up';

const POINTER_ID = 1;

/** DOM `button` / `buttons` values for each gesture button. */
const BUTTONS: Readonly<
  Record<PointerButton, { readonly button: number; readonly buttons: number }>
> = {
  primary: { button: 0, buttons: 1 },
  secondary: { button: 2, buttons: 2 },
};

function pointerInit(
  phase: PointerPhase,
  point: Point,
  button: PointerButton
): PointerEventInit {
  const b = BUTTONS[button];
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: POINTER_ID,
    pointerType: 'mouse',
    isPrimary: true,
    button: phase === 'move' ? -1 : b.button,
    buttons: phase === 'up' ? 0 : b.buttons,
    clientX: point.x,
    clientY: point.y,
    screenX: point.x,
    screenY: point.y,
  };
}

function dispatchPointer(
  element: Element,
  phase: PointerPhase,
  point: Point,
  button: PointerButton
): void {
  const init = pointerInit(phase, point, button);
  element.dispatchEvent(new PointerEvent(`pointer${phase}`, init));
  const mouseType =
    phase === 'down' ? 'mousedown' : phase === 'up' ? 'mouseup' : 'mousemove';
  element.dispatchEvent(new MouseEvent(mouseType, init));
  // A secondary press opens the context menu (on press, as macOS / Linux do).
  if (phase === 'down' && button === 'secondary') {
    element.dispatchEvent(new MouseEvent('contextmenu', init));
  }
}

/** Primary release → `click`; secondary release → `auxclick`. */
function dispatchRelease(
  element: Element,
  point: Point,
  button: PointerButton
): void {
  const type = button === 'primary' ? 'click' : 'auxclick';
  element.dispatchEvent(new MouseEvent(type, pointerInit('up', point, button)));
}

/** Press + release at a relative position, followed by `click`. */
export function fireTapAt(
  element: Element,
  position: TapPosition,
  provider: LayoutProvider,
  options?: GestureOptions
): void {
  const button = options?.button ?? 'primary';
  const layout = ensureElementLayout(element, provider);
  const point = pointFromRatio(layout, position);
  dispatchPointer(element, 'down', point, button);
  dispatchPointer(element, 'up', point, button);
  dispatchRelease(element, point, button);
}

type DragPath = {
  readonly from: TapPosition;
  readonly to: TapPosition;
};

/** Press at `from`, move through the midpoint, release at `to`. */
export function fireDrag(
  element: Element,
  path: DragPath,
  provider: LayoutProvider,
  options?: GestureOptions
): void {
  const button = options?.button ?? 'primary';
  const layout = ensureElementLayout(element, provider);
  const start = pointFromRatio(layout, path.from);
  const end = pointFromRatio(layout, path.to);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  dispatchPointer(element, 'down', start, button);
  dispatchPointer(element, 'move', mid, button);
  dispatchPointer(element, 'move', end, button);
  dispatchPointer(element, 'up', end, button);
}
