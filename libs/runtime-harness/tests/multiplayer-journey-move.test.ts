import { expect, test } from 'bun:test';
import { openWithE4AndE5 } from '@libs/runtime-harness/multiplayer-journey';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

function device(white: boolean) {
  let previousArrived = white;
  const actions: string[] = [];
  const unused = (): never => {
    throw new Error('unexpected gesture');
  };
  const ui: Driver = {
    kind: 'delayed-opponent',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: unused,
      tap: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      drag: unused,
      selectFile: unused,
      isVisible: unused,
      text: async () => (white ? 'White' : 'Black'),
      layout: async () => null,
      tapAt: async () => {
        if (!previousArrived)
          throw new Error('e4 has not arrived on Black device');
        actions.push('tap');
      },
      expect: {
        hidden: unused,
        visible: async () => {},
        text: async (value) => {
          if (id === 'multiplayer-move-list' && value === '1. e4') {
            previousArrived = true;
            actions.push('observe-e4');
          }
        },
      },
    }),
  };
  return { ui, actions };
}

// regression: multiplayer-journey-moves-before-opponent-update
test('Black observes the accepted e2-e4 before tapping e7-e5', async () => {
  const white = device(true);
  const black = device(false);
  await openWithE4AndE5({
    act: async (_name, gesture) => gesture(white.ui),
    actAsGuest: async (_name, gesture) => gesture(black.ui),
  });
  expect(black.actions).toEqual(['observe-e4', 'tap', 'tap']);
});
