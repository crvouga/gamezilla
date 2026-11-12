/**
 * Dragging a tab with the pointer.
 *
 * A press becomes a drag once it travels {@link WINDOW_DRAG_THRESHOLD} px;
 * until then it is still a click. The press is followed on the document, so a
 * fast pointer that leaves the tab in one move still starts the drag; once it
 * is a drag the tab captures the pointer, so it keeps tracking over embedded
 * frames. What the drop would do is read from the same frames the windows are
 * drawn from.
 */

import {
  type WindowDropTarget,
  type WindowFrame,
  windowDropTarget,
} from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import { type Accessor, createSignal } from 'solid-js';
import { WINDOW_TAB_BAR_HEIGHT } from './window-manager-types';

export const WINDOW_DRAG_THRESHOLD = 6;

export type WindowDragState = {
  readonly panel: string;
  /** The pointer, in px from the manager's top-left corner. */
  readonly x: number;
  readonly y: number;
  readonly target: WindowDropTarget | null;
  /** On a tab bar: the index the tab lands at and where to draw the marker. */
  readonly index: number | null;
  readonly marker: number | null;
};

export type WindowDragController = {
  readonly state: Accessor<WindowDragState | null>;
  /** A press on a tab; the rest of the gesture is followed from here. */
  readonly down: (panel: string, event: PointerEvent) => void;
  readonly cancel: () => void;
  /** True once after a drag: the click that ends it selects nothing. */
  readonly consumeClick: () => boolean;
};

export type WindowDragOptions = {
  readonly root: () => HTMLElement | undefined;
  readonly frames: () => readonly WindowFrame[];
  readonly enabled: () => boolean;
  /** Tab elements of a window other than the dragged panel's, in order. */
  readonly tabsOf: (window: string, except: string) => readonly HTMLElement[];
  readonly onDrop: (state: WindowDragState) => void;
};

type Press = {
  readonly panel: string;
  readonly element: EventTarget | null;
  /** Stops following the gesture on the document. */
  readonly release: () => void;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
};

function insertion(
  tabs: readonly HTMLElement[],
  clientX: number,
  rootLeft: number
): { readonly index: number; readonly marker: number | null } {
  const boxes = tabs.map((tab) => tab.getBoundingClientRect());
  const before = boxes.findIndex((box) => clientX < box.left + box.width / 2);
  const index = before === -1 ? boxes.length : before;
  const edge = boxes[index]?.left ?? boxes[boxes.length - 1]?.right;
  return { index, marker: edge === undefined ? null : edge - rootLeft };
}

/**
 * Keeps the pointer on `element` for the rest of the gesture. A pointer the
 * browser does not know (a scripted event) cannot be captured; the gesture
 * then tracks only while the pointer stays over the element.
 */
export function captureWindowPointer(
  element: EventTarget | null,
  pointerId: number
): void {
  if (!(element instanceof Element) || !('setPointerCapture' in element))
    return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // No such active pointer: nothing to capture.
  }
}

export function createWindowDrag(
  options: WindowDragOptions
): WindowDragController {
  const [state, setState] = createSignal<WindowDragState | null>(null);
  let press: Press | null = null;
  let dragged = false;

  const locate = (panel: string, event: PointerEvent): WindowDragState => {
    const box = options.root()?.getBoundingClientRect();
    const at = {
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
    };
    const base = { panel, ...at, target: null, index: null, marker: null };
    if (box === undefined || box.width <= 0 || box.height <= 0) return base;
    const target = windowDropTarget({
      frames: options.frames(),
      point: { x: at.x / box.width, y: at.y / box.height },
      tabBarHeight: WINDOW_TAB_BAR_HEIGHT / box.height,
    });
    if (target?.zone !== 'tabs') return { ...base, target };
    const tabs = options.tabsOf(target.window, panel);
    return { ...base, target, ...insertion(tabs, event.clientX, box.left) };
  };

  const end = (): void => {
    press?.release();
    press = null;
  };
  const move = (event: PointerEvent): void => {
    if (press === null || event.pointerId !== press.pointerId) return;
    if (state() === null) {
      const travel = Math.hypot(
        event.clientX - press.x,
        event.clientY - press.y
      );
      if (travel < WINDOW_DRAG_THRESHOLD) return;
      captureWindowPointer(press.element, event.pointerId);
    }
    setState(locate(press.panel, event));
  };
  const up = (event: PointerEvent): void => {
    if (press === null || event.pointerId !== press.pointerId) return;
    const current = state();
    end();
    if (current === null) return;
    dragged = true;
    setState(null);
    options.onDrop(locate(current.panel, event));
  };
  const cancel = (): void => {
    end();
    setState(null);
  };
  const follow = (element: EventTarget | null): (() => void) => {
    const page = element instanceof Node ? element.ownerDocument : null;
    if (page === null) return () => undefined;
    page.addEventListener('pointermove', move, true);
    page.addEventListener('pointerup', up, true);
    page.addEventListener('pointercancel', cancel, true);
    return () => {
      page.removeEventListener('pointermove', move, true);
      page.removeEventListener('pointerup', up, true);
      page.removeEventListener('pointercancel', cancel, true);
    };
  };

  return {
    state,
    down: (panel, event) => {
      end();
      dragged = false;
      if (!options.enabled() || event.button !== 0) return;
      press = {
        panel,
        element: event.currentTarget,
        release: follow(event.currentTarget),
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    },
    cancel,
    consumeClick: () => {
      const was = dragged;
      dragged = false;
      return was;
    },
  };
}
