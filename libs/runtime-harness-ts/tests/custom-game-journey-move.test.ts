import { expect, test } from 'bun:test';
import { playCustomGameE4 } from '@libs/runtime-harness-ts/custom-game-journey';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

/**
 * A board that takes no move until it has been asked `ignoredPairs` times,
 * the way the shipped board ignores a person while their start choice still
 * waits for the room.
 */
function boardIgnoring(ignoredPairs: number): {
  readonly ui: Driver;
  readonly pairs: () => number;
} {
  let taps = 0;
  const unused = (): never => {
    throw new Error('not part of this example');
  };
  const moved = (): boolean => taps / 2 > ignoredPairs;
  const node = (id: string): DriverNode => ({
    get: unused,
    attribute: unused,
    tapAt: async () => {
      taps += 1;
    },
    drag: unused,
    selectFile: unused,
    input: unused,
    clear: unused,
    key: unused,
    scroll: unused,
    wait: unused,
    isVisible: unused,
    text: unused,
    tap: unused,
    layout: async () => ({ x: 0, y: 0, width: 400, height: 400 }),
    expect: {
      visible: async () => {},
      hidden: unused,
      text: async (expected) => {
        if (id !== 'custom-game-review-move-1' || expected !== 'e4')
          return unused();
        if (!moved()) throw new Error('Timed out waiting for text equals "e4"');
      },
    },
  });
  const ui: Driver = {
    kind: 'board-example',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: node,
  };
  return { ui, pairs: () => taps / 2 };
}

// regression: custom-game-move-lost-before-board-takes-input
test('White plays e2-e4 again when the board did not take the first try', async () => {
  const { ui, pairs } = boardIgnoring(2);
  await playCustomGameE4(ui);
  expect(pairs()).toBe(3);
});

test('White plays e2-e4 once when the board takes it at once', async () => {
  const { ui, pairs } = boardIgnoring(0);
  await playCustomGameE4(ui);
  expect(pairs()).toBe(1);
});

test('a board that never takes the move fails the step', async () => {
  const { ui } = boardIgnoring(Number.POSITIVE_INFINITY);
  await expect(playCustomGameE4(ui)).rejects.toThrow('waiting for text');
});
