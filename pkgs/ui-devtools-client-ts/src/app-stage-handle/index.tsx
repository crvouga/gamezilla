/** @jsxImportSource solid-js */
/**
 * The handle of an `AppStage`: the one small button that floats over the
 * view on show, and switches to the next. Renders inside one.
 */

import { ArrowLeftRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX } from 'solid-js';
import styles from '../app-stage/app-stage.module.css';

/** The button's diameter, in px. */
export const APP_STAGE_HANDLE_SIZE = 44;
/** Room kept between the button and the edges it rests against, in px. */
const EDGE = 10;
/** How far a press may wander and still be a tap, in px. */
const TAP_SLOP = 8;
type Point = { readonly x: number; readonly y: number };

/** Where the button rests: against a side, some way down it. */
type Rest = {
  readonly side: 'left' | 'right';
  /** The top of the button, as a share of the room it can move in. */
  readonly down: number;
};

type Press = {
  readonly pointer: number;
  readonly from: Point;
  /** Where in the button the press landed. */
  readonly grab: Point;
  moved: boolean;
};

/** Clear of the app's tab bar and its floating action, where a thumb reaches. */
const START: Rest = { side: 'right', down: 0.62 };

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

type Place = {
  readonly dragging: () => boolean;
  readonly style: () => JSX.CSSProperties;
  /** Follow the pointer, which grabbed the button at `grab`. */
  readonly drag: (event: PointerEvent, grab: Point) => void;
  /** Come to rest against the nearer side. */
  readonly settle: () => void;
};

/** Where the button is: at rest against a side, or under the pointer. */
function createPlace(button: () => HTMLButtonElement | undefined): Place {
  const [rest, setRest] = createSignal<Rest>(START);
  const [dragged, setDragged] = createSignal<Point | null>(null);
  const room = (): { readonly width: number; readonly height: number } => {
    // The stage itself: the handle is its direct child.
    const parent = button()?.parentElement;
    return {
      width: (parent?.clientWidth ?? 0) - APP_STAGE_HANDLE_SIZE,
      height: (parent?.clientHeight ?? 0) - APP_STAGE_HANDLE_SIZE,
    };
  };
  const size = `${String(APP_STAGE_HANDLE_SIZE)}px`;
  return {
    dragging: () => dragged() !== null,
    drag: (event, grab) => {
      const parent = button()?.parentElement?.getBoundingClientRect();
      if (parent === undefined) return;
      const { width, height } = room();
      setDragged({
        x: clamp(event.clientX - parent.left - grab.x, EDGE, width - EDGE),
        y: clamp(event.clientY - parent.top - grab.y, EDGE, height - EDGE),
      });
    },
    settle: () => {
      const at = dragged();
      if (at === null) return;
      const { width, height } = room();
      setRest({
        side: at.x < width / 2 ? 'left' : 'right',
        down: height <= 0 ? START.down : clamp(at.y / height, 0, 1),
      });
      setDragged(null);
    },
    style: () => {
      const at = dragged();
      if (at !== null)
        return {
          width: size,
          height: size,
          left: `${String(at.x)}px`,
          top: `${String(at.y)}px`,
        };
      const where = rest();
      return {
        width: size,
        height: size,
        [where.side]: `${String(EDGE)}px`,
        // Its share of the room, held off the top and bottom edges.
        top: `clamp(${String(EDGE)}px, calc((100% - ${size}) * ${String(where.down)}), calc(100% - ${size} - ${String(EDGE)}px))`,
      };
    },
  };
}

type Gesture = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerUp: (event: PointerEvent) => void;
  readonly onPointerCancel: () => void;
};

/** One press read as a tap or a drag, however long it is held. */
function createGesture(args: {
  readonly button: () => HTMLButtonElement | undefined;
  readonly place: Place;
  readonly onTap: () => void;
}): Gesture {
  let press: Press | null = null;
  return {
    onPointerDown: (event) => {
      const button = args.button();
      if (event.button !== 0 || button === undefined) return;
      const box = button.getBoundingClientRect();
      press = {
        pointer: event.pointerId,
        from: { x: event.clientX, y: event.clientY },
        grab: { x: event.clientX - box.left, y: event.clientY - box.top },
        moved: false,
      };
      button.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (press === null || event.pointerId !== press.pointer) return;
      const far =
        Math.hypot(event.clientX - press.from.x, event.clientY - press.from.y) >
        TAP_SLOP;
      if (!press.moved && !far) return;
      press.moved = true;
      args.place.drag(event, press.grab);
    },
    onPointerUp: (event) => {
      if (press === null || event.pointerId !== press.pointer) return;
      const done = press;
      press = null;
      if (done.moved) args.place.settle();
      else args.onTap();
    },
    onPointerCancel: () => {
      press = null;
      args.place.settle();
    },
  };
}

export type AppStageHandleProps = {
  /** Says what is on show and where a press goes. */
  readonly label: string;
  /** Switch: on to the next view. */
  readonly onTap: () => void;
};

/** The handle of an `AppStage`. Renders inside one. */
export function AppStageHandle(props: AppStageHandleProps): JSX.Element {
  let button: HTMLButtonElement | undefined;
  const place = createPlace(() => button);
  const gesture = createGesture({
    button: () => button,
    place,
    onTap: () => props.onTap(),
  });
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) props.onTap();
  };
  return (
    <button
      ref={(element) => {
        button = element;
      }}
      type="button"
      class={`box absolute z-10 items-center justify-center rounded-full border border-solid border-border bg-surface select-none touch-none ${styles['handle'] ?? ''}`}
      style={place.style()}
      aria-label={props.label}
      data-component={componentId('AppStageHandle')}
      {...dataAttrs({
        'stage-part': 'handle',
        dragging: String(place.dragging()),
      })}
      // The press and the drag are both the pointer's; the click a pointer
      // also makes would switch a second time.
      onClick={(event) => event.preventDefault()}
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <ArrowLeftRightIcon size={18} color="icon" />
    </button>
  );
}
