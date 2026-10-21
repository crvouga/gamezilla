import { expect, test } from 'bun:test';
import { PLAY_E5 } from '@libs/runtime-harness-ts/multiplayer-journey';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

/**
 * A board that takes no move until it has been asked `ignoredPairs` times,
 * the way the shipped board ignores a person while the opponent's move or
 * their own earlier choice still settles.
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
        if (id !== 'multiplayer-move-list') return unused();
        if (expected === '1. e4') return;
        if (!moved())
          throw new Error('Timed out waiting for text contains "1. e4 e5"');
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

/**
 * A board whose move list has not yet shown White's accepted e2-e4: Black's
 * squares throw if tapped, the way the shipped board rejects an input before
 * the opponent's move has arrived over the network.
 */
function boardAwaitingOpponentsMove(): {
  readonly ui: Driver;
  readonly actions: () => readonly string[];
} {
  let arrived = false;
  let taps = 0;
  const actions: string[] = [];
  const unused = (): never => {
    throw new Error('not part of this example');
  };
  const node = (id: string): DriverNode => ({
    get: unused,
    attribute: unused,
    tapAt: async () => {
      if (!arrived) throw new Error('e4 has not arrived on Black device');
      taps += 1;
      actions.push('tap');
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
      visible: unused,
      hidden: unused,
      text: async (expected) => {
        if (id !== 'multiplayer-move-list') return unused();
        if (expected === '1. e4') {
          arrived = true;
          actions.push('observe-e4');
          return;
        }
        if (expected === '1. e4 e5' && taps >= 2) return;
        throw new Error('Timed out waiting for text contains "1. e4 e5"');
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
  return { ui, actions: () => actions };
}

// regression: multiplayer-journey-moves-before-opponent-update
test('Black waits for the accepted e2-e4 before tapping e7-e5', async () => {
  const { ui, actions } = boardAwaitingOpponentsMove();
  await PLAY_E5(ui);
  expect(actions()).toEqual(['observe-e4', 'tap', 'tap']);
});

// regression: multiplayer-move-lost-before-board-takes-input
test('Black plays e7-e5 again when the board did not take the first try', async () => {
  const { ui, pairs } = boardIgnoring(2);
  await PLAY_E5(ui);
  expect(pairs()).toBe(3);
});

test('Black plays e7-e5 once when the board takes it at once', async () => {
  const { ui, pairs } = boardIgnoring(0);
  await PLAY_E5(ui);
  expect(pairs()).toBe(1);
});

test('a board that never takes the move fails the step', async () => {
  const { ui } = boardIgnoring(Number.POSITIVE_INFINITY);
  await expect(PLAY_E5(ui)).rejects.toThrow('waiting for text');
});
