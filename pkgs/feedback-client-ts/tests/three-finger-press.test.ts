import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  createThreeFingerPress,
  type Finger,
  installThreeFingerPress,
  THREE_FINGER_PRESS_MS,
  THREE_FINGER_WOBBLE_PX,
} from '../src/three-finger-press';

/** This many fingers resting side by side. */
const resting = (count: number): Finger[] =>
  Array.from({ length: count }, (_, id) => ({ id, x: 100 + id * 60, y: 300 }));

/** A screen feeling for a three-finger press; counts how many it recognised. */
function createScreen() {
  const { clock, timers } = createHarnessClock();
  const screen = { presses: 0 };
  const press = createThreeFingerPress({
    timers,
    onPress: () => {
      screen.presses++;
    },
  });
  return Object.assign(screen, { press, wait: clock.advance });
}

describe('telling a three-finger press from everything else hands do', () => {
  test('three fingers held still for a second are a press', () => {
    const screen = createScreen();
    screen.press.fingers(resting(3));
    screen.wait(THREE_FINGER_PRESS_MS - 1);
    expect(screen.presses).toBe(0);
    screen.wait(1);
    expect(screen.presses).toBe(1);
  });

  test('two fingers are never a press', () => {
    const screen = createScreen();
    screen.press.fingers(resting(2));
    screen.wait(5 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(0);
  });

  test('four fingers are never a press', () => {
    const screen = createScreen();
    screen.press.fingers(resting(4));
    screen.wait(5 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(0);
  });

  test('fingers lifted at 900 ms are not a press', () => {
    const screen = createScreen();
    screen.press.fingers(resting(3));
    screen.wait(900);
    screen.press.fingers(resting(2));
    screen.press.fingers([]);
    screen.wait(5 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(0);
  });

  test('a finger that wobbles within the tolerance is still held still', () => {
    const screen = createScreen();
    const [first, ...others] = resting(3) as [Finger, Finger, Finger];
    screen.press.fingers([first, ...others]);
    screen.wait(500);
    screen.press.fingers([
      { ...first, x: first.x + THREE_FINGER_WOBBLE_PX },
      ...others,
    ]);
    screen.wait(500);
    expect(screen.presses).toBe(1);
  });

  test('a finger that moves beyond the tolerance ends the press, even if it comes back', () => {
    const screen = createScreen();
    const [first, ...others] = resting(3) as [Finger, Finger, Finger];
    screen.press.fingers([first, ...others]);
    screen.wait(500);
    screen.press.fingers([
      { ...first, y: first.y + THREE_FINGER_WOBBLE_PX + 1 },
      ...others,
    ]);
    screen.press.fingers([first, ...others]);
    screen.wait(5 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(0);
  });

  test('a fourth finger landing ends the press, even once it lifts again', () => {
    const screen = createScreen();
    screen.press.fingers(resting(3));
    screen.wait(500);
    screen.press.fingers(resting(4));
    screen.press.fingers(resting(3));
    screen.wait(5 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(0);
  });

  test('fingers the device takes away are not a press', () => {
    const screen = createScreen();
    screen.press.fingers(resting(3));
    screen.wait(500);
    screen.press.cancel();
    screen.wait(5 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(0);
  });

  test('holding longer than a second is one press', () => {
    const screen = createScreen();
    screen.press.fingers(resting(3));
    screen.wait(10 * THREE_FINGER_PRESS_MS);
    screen.press.fingers(resting(3));
    screen.wait(10 * THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(1);
  });

  test('the second starts when the third finger lands', () => {
    const screen = createScreen();
    screen.press.fingers(resting(2));
    screen.wait(900);
    screen.press.fingers(resting(3));
    screen.wait(900);
    expect(screen.presses).toBe(0);
    screen.wait(100);
    expect(screen.presses).toBe(1);
  });

  test('pressing again after lifting every finger is a press again', () => {
    const screen = createScreen();
    screen.press.fingers(resting(3));
    screen.wait(THREE_FINGER_PRESS_MS);
    screen.press.fingers([]);
    screen.press.fingers(resting(3));
    screen.wait(THREE_FINGER_PRESS_MS);
    expect(screen.presses).toBe(2);
  });
});

/** An app of its own in the page, feeling for a three-finger press on itself. */
function createApp(timers: ReturnType<typeof createHarnessClock>['timers']) {
  const element = document.createElement('main');
  document.body.append(element);
  const app = { element, presses: 0, prevented: 0 };
  const stop = installThreeFingerPress({
    target: element,
    timers,
    onPress: () => {
      app.presses++;
    },
  });
  function touch(type: string, on: Touch[], changed: Touch[]): void {
    const event = new TouchEvent(type, {
      touches: on,
      targetTouches: on,
      changedTouches: changed,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    if (event.defaultPrevented) app.prevented++;
  }
  const fingers = (count: number): Touch[] =>
    Array.from(
      { length: count },
      (_, identifier) =>
        new Touch({
          identifier,
          target: element,
          clientX: 100 + identifier * 60,
          clientY: 300,
        })
    );
  return Object.assign(app, {
    touch,
    fingers,
    land(count: number): Touch[] {
      const down = fingers(count);
      for (const [index, finger] of down.entries())
        touch('touchstart', down.slice(0, index + 1), [finger]);
      return down;
    },
    /** Whether a menu asked for now would be let through. */
    menuShows(): boolean {
      return element.dispatchEvent(
        new Event('contextmenu', { bubbles: true, cancelable: true })
      );
    },
    remove(): void {
      stop();
      element.remove();
    },
  });
}

describe('a three-finger press on an app in the page', () => {
  test('is felt by that app and by no other app beside it', () => {
    const { clock, timers } = createHarnessClock();
    const pressed = createApp(timers);
    const beside = createApp(timers);
    pressed.land(3);
    clock.advance(THREE_FINGER_PRESS_MS);
    expect(pressed.presses).toBe(1);
    expect(beside.presses).toBe(0);
    pressed.remove();
    beside.remove();
  });

  test('counts only the fingers on that app', () => {
    const { clock, timers } = createHarnessClock();
    const app = createApp(timers);
    const beside = createApp(timers);
    const [first, second] = app.fingers(2);
    const [elsewhere] = beside.fingers(1);
    if (!first || !second || !elsewhere) throw new Error('No fingers');
    app.touch('touchstart', [first, second, elsewhere], [first, second]);
    beside.touch('touchstart', [first, second, elsewhere], [elsewhere]);
    clock.advance(5 * THREE_FINGER_PRESS_MS);
    expect(app.presses).toBe(0);
    expect(beside.presses).toBe(0);
    app.remove();
    beside.remove();
  });

  test('never takes a touch away from the app', () => {
    const { clock, timers } = createHarnessClock();
    const app = createApp(timers);
    const down = app.land(3);
    app.touch('touchmove', down, down);
    clock.advance(THREE_FINGER_PRESS_MS);
    app.touch('touchend', [], down);
    expect(app.presses).toBe(1);
    expect(app.prevented).toBe(0);
    app.remove();
  });

  test('fingers the device takes away are not a press', () => {
    const { clock, timers } = createHarnessClock();
    const app = createApp(timers);
    const down = app.land(3);
    clock.advance(500);
    app.touch('touchcancel', [], down);
    clock.advance(5 * THREE_FINGER_PRESS_MS);
    expect(app.presses).toBe(0);
    app.remove();
  });

  test('holds back the long-press menu only while three fingers rest on the app', () => {
    const { clock, timers } = createHarnessClock();
    const app = createApp(timers);
    expect(app.menuShows()).toBe(true);
    const down = app.land(3);
    expect(app.menuShows()).toBe(false);
    clock.advance(THREE_FINGER_PRESS_MS);
    expect(app.menuShows()).toBe(false);
    app.touch('touchend', [], down);
    expect(app.menuShows()).toBe(true);
    app.remove();
  });

  test('feels nothing once it is taken away', () => {
    const { clock, timers } = createHarnessClock();
    const app = createApp(timers);
    app.land(3);
    app.remove();
    clock.advance(5 * THREE_FINGER_PRESS_MS);
    expect(app.presses).toBe(0);
  });
});
