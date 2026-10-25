import type {
  TrailControls,
  TrailHeading,
  TrailSlot,
} from './trail-arena-types';

const ARROWS: Readonly<Record<string, TrailHeading>> = {
  arrowup: 'up',
  arrowright: 'right',
  arrowdown: 'down',
  arrowleft: 'left',
};

/** By character first, then by key position, so ZQSD layouts steer too. */
const LETTERS: Readonly<Record<string, TrailHeading>> = {
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left',
  keyw: 'up',
  keyd: 'right',
  keys: 'down',
  keya: 'left',
};

/** Pixels a touch travels before it counts as a swipe. */
const SWIPE_DISTANCE = 24;

/** How many local riders this device steers: none, one or two. */
export function controlledSlots(controls: TrailControls): number {
  let count = 0;
  for (const rider of controls.riders) if (rider.controlled) count++;
  return Math.min(count, 2);
}

function keyIntent(
  event: KeyboardEvent,
  slots: number
): { heading: TrailHeading; slot: TrailSlot } | undefined {
  const name = event.key.toLowerCase();
  const arrow = ARROWS[name];
  if (arrow !== undefined) return { heading: arrow, slot: 0 };
  const letter = LETTERS[name] ?? LETTERS[event.code.toLowerCase()];
  if (letter === undefined) return undefined;
  return { heading: letter, slot: slots >= 2 ? 1 : 0 };
}

function swipeHeading(dx: number, dy: number): TrailHeading | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return undefined;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

type Swipe = { slot: TrailSlot; x: number; y: number };

/**
 * Raw device events end here; consumers receive a heading and the local
 * rider slot it steers. Arrow keys steer slot 0; WASD steers slot 1 when
 * two riders share the keyboard, and slot 0 otherwise. A swipe steers the
 * rider on its side of the arena: the WASD rider on the left half when two
 * share the screen.
 */
export function trailArenaInput(props: TrailControls) {
  const swipes = new Map<number, Swipe>();
  const keyDown = (event: KeyboardEvent) => {
    const slots = controlledSlots(props);
    if (
      !props.enabled ||
      slots === 0 ||
      event.target !== event.currentTarget ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const intent = keyIntent(event, slots);
    if (intent === undefined) return;
    event.preventDefault();
    if (!event.repeat) props.onDirection(intent.heading, intent.slot);
  };
  const pointerDown = (
    event: PointerEvent & { currentTarget: HTMLDivElement }
  ) => {
    const slots = controlledSlots(props);
    if (
      !props.enabled ||
      slots === 0 ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const left = event.clientX - rect.left < rect.width / 2;
    swipes.set(event.pointerId, {
      slot: slots >= 2 && left ? 1 : 0,
      x: event.clientX,
      y: event.clientY,
    });
    element.setPointerCapture(event.pointerId);
    element.focus();
  };
  const pointerMove = (event: PointerEvent) => {
    const swipe = swipes.get(event.pointerId);
    if (swipe === undefined || !props.enabled) return;
    const heading = swipeHeading(
      event.clientX - swipe.x,
      event.clientY - swipe.y
    );
    if (heading === undefined) return;
    swipe.x = event.clientX;
    swipe.y = event.clientY;
    props.onDirection(heading, swipe.slot);
  };
  const pointerUp = (event: PointerEvent) => {
    swipes.delete(event.pointerId);
  };
  return { keyDown, pointerDown, pointerMove, pointerUp };
}
