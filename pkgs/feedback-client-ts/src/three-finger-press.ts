import type { Timers } from '@pkgs/clock-shared-ts/types';

/** How long three fingers must stay down. */
export const THREE_FINGER_PRESS_MS = 1000;
/**
 * How far, in CSS px, a finger may drift from where it landed and still be
 * held still. A resting fingertip rolls a few px; a swipe or a pinch passes
 * this within its first frames.
 */
export const THREE_FINGER_WOBBLE_PX = 10;
const FINGERS = 3;

/** One finger on the app: which one, and where, in CSS px. */
export type Finger = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
};

export type ThreeFingerPress = {
  /** Every finger on the app right now, told whenever one lands, moves or lifts. */
  fingers(now: readonly Finger[]): void;
  /** The device took the fingers away for a gesture of its own. */
  cancel(): void;
  /** Three fingers are resting on the app: waiting out the second, or just recognised. */
  holding(): boolean;
  dispose(): void;
};

/**
 * Tells a three-finger press — exactly three fingers held still for one
 * second — from everything else hands do on a screen. A swipe, a pinch, a
 * fourth finger or a gesture the device takes for itself ends the attempt
 * until every finger has lifted, so a press is never recognised out of the
 * tail of another gesture, and one long press is recognised once.
 */
export function createThreeFingerPress(options: {
  readonly timers: Timers;
  readonly onPress: () => void;
}): ThreeFingerPress {
  const { timers } = options;
  /** Where the three fingers landed, while their second is being waited out. */
  let landed: readonly Finger[] | null = null;
  let timer: unknown = null;
  /** Nothing more can come of the fingers now down. */
  let over = false;
  let recognised = false;

  function stop(): void {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    landed = null;
  }
  function start(now: readonly Finger[]): void {
    stop();
    landed = now;
    timer = timers.setTimeout(() => {
      timer = null;
      landed = null;
      over = true;
      recognised = true;
      options.onPress();
    }, THREE_FINGER_PRESS_MS);
  }
  function moved(from: readonly Finger[], now: readonly Finger[]): boolean {
    return now.some((finger) => {
      const origin = from.find((other) => other.id === finger.id);
      return (
        origin !== undefined &&
        Math.hypot(finger.x - origin.x, finger.y - origin.y) >
          THREE_FINGER_WOBBLE_PX
      );
    });
  }
  function same(from: readonly Finger[], now: readonly Finger[]): boolean {
    return now.every((finger) => from.some((other) => other.id === finger.id));
  }

  return {
    fingers(now) {
      if (now.length === 0) {
        stop();
        over = false;
        recognised = false;
        return;
      }
      if (over) return;
      if (now.length > FINGERS || (landed !== null && moved(landed, now))) {
        stop();
        over = true;
      } else if (now.length < FINGERS) stop();
      // Another finger than the one that lifted: the second starts again.
      else if (landed === null || !same(landed, now)) start(now);
    },
    cancel() {
      stop();
      over = true;
    },
    holding: () => landed !== null || recognised,
    dispose: stop,
  };
}

/**
 * Feels for a three-finger press on `target` alone: fingers resting on
 * anything else, another app in the same page included, are not counted.
 *
 * It only ever watches. The listeners are passive and no touch is prevented,
 * so scrolling, games, text selection and the device's own three-finger
 * gestures go on as if it were not there. The one thing it holds back is the
 * menu a long press may raise while three fingers rest on the app, which
 * would otherwise sit on top of the bug report.
 */
export function installThreeFingerPress(options: {
  readonly target: Node;
  readonly timers: Timers;
  readonly onPress: () => void;
}): () => void {
  const { target } = options;
  const press = createThreeFingerPress(options);
  const tell = (event: Event): void => {
    const fingers: Finger[] = [];
    for (const touch of Array.from((event as TouchEvent).touches))
      if (target.contains(touch.target as Node))
        fingers.push({
          id: touch.identifier,
          x: touch.clientX,
          y: touch.clientY,
        });
    if (event.type === 'touchcancel') press.cancel();
    press.fingers(fingers);
  };
  const onMenu = (event: Event): void => {
    if (press.holding()) event.preventDefault();
  };
  const touches = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
  for (const type of touches)
    target.addEventListener(type, tell, { passive: true });
  target.addEventListener('contextmenu', onMenu);
  return () => {
    for (const type of touches) target.removeEventListener(type, tell);
    target.removeEventListener('contextmenu', onMenu);
    press.dispose();
  };
}
