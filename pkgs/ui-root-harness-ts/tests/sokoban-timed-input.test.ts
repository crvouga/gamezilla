import { expect, test } from 'bun:test';
import type { Page } from '@playwright/test';
import {
  prepareSokobanMoves,
  readSokobanMoveFrame,
  runSokobanMoves,
  walking,
  withPushAndUndo,
} from '../storybook/sokoban-timed-input';

// regression: sokoban-timing-requeries-the-board
test('twenty real keys reuse the prepared count and await each expected frame', async () => {
  const events: string[] = [];
  let observed = 6;
  const page = {
    keyboard: {
      press: (key: string) => {
        events.push(key);
        observed++;
        return Promise.resolve();
      },
    },
    getByTestId: (id: string) => {
      events.push(`query:${id}`);
      return {
        press: (key: string) => page.keyboard.press(key),
        elementHandle: () =>
          Promise.resolve({
            evaluate: (_callback: unknown, expected: number) => {
              events.push(`frame:${expected}`);
              return Promise.resolve(String(observed));
            },
            dispose: () => {
              events.push('dispose');
              return Promise.resolve();
            },
          }),
      };
    },
  } as unknown as Page;
  const moves = await prepareSokobanMoves(page);
  await runSokobanMoves(page, walking(6), moves.readAfterFrame);
  await moves.dispose();
  expect(events).toEqual([
    'query:sokoban-counts',
    ...Array.from({ length: 20 }, (_, i) => [
      i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight',
      `frame:${i + 7}`,
    ]).flat(),
    'dispose',
  ]);
});

test('the push-and-undo pass prepares its targets before all twenty timed inputs', async () => {
  const events: string[] = [];
  const page = {
    getByRole: () => {
      events.push('resolve Undo');
      return { evaluate: () => Promise.resolve({ x: 36, y: 724 }) };
    },
    getByTestId: () => {
      events.push('resolve board');
      return {
        elementHandle: () =>
          Promise.resolve({
            focus: () => events.push('focus board'),
            dispose: () => events.push('dispose'),
          }),
      };
    },
    keyboard: { press: (key: string) => events.push(key) },
    mouse: { click: (x: number, y: number) => events.push(`click ${x} ${y}`) },
  } as unknown as Page;
  await withPushAndUndo(page, async (step) => {
    events.push('start timing');
    await runSokobanMoves(page, step, (count) => {
      events.push(`frame:${count}`);
      return Promise.resolve(String(count));
    });
  });
  expect(events).toEqual([
    'resolve Undo',
    'resolve board',
    'start timing',
    ...Array.from({ length: 10 }, () => [
      'focus board',
      'ArrowRight',
      'frame:1',
      'click 36 724',
      'frame:0',
    ]).flat(),
    'dispose',
  ]);
});

test('an incorrect count fails before another input can hide the failure', async () => {
  let keys = 0;
  const page = {
    keyboard: {
      press: () => {
        keys++;
        return Promise.resolve();
      },
    },
  } as unknown as Page;
  const result = await runSokobanMoves(page, walking(6), () =>
    Promise.resolve('6')
  ).catch((error: unknown) => error);
  expect(result).toBeInstanceOf(Error);
  expect(String(result)).toContain('expected 7 moves, received 6');
  expect(keys).toBe(1);
});

test('count updates can arrive on a later frame within the existing assertion budget', async () => {
  const frameDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'requestAnimationFrame'
  );
  const timeDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'performance'
  );
  const frames: (() => void)[] = [];
  let now = 0;
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (frame: () => void) => frames.push(frame),
  });
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: { now: () => now },
  });
  const element = document.createElement('div');
  element.setAttribute('data-moves', '6');
  try {
    const pending = readSokobanMoveFrame(element, 7);
    frames.shift()?.();
    expect(frames).toHaveLength(1);
    element.setAttribute('data-moves', '7');
    frames.shift()?.();
    expect(await pending).toBe('7');
    const wrong = readSokobanMoveFrame(element, 8);
    now = 5000;
    frames.shift()?.();
    expect(await wrong).toBe('7');
    expect(frames).toHaveLength(0);
  } finally {
    if (frameDescriptor)
      Object.defineProperty(
        globalThis,
        'requestAnimationFrame',
        frameDescriptor
      );
    if (timeDescriptor)
      Object.defineProperty(globalThis, 'performance', timeDescriptor);
  }
});
