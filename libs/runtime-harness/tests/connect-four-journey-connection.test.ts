import { expect, test } from 'bun:test';
import { dropConnectFourDisc } from '@libs/runtime-harness/connect-four-journey';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

function pendingOpponent(): { ui: Driver; gestures: string[] } {
  let received = false;
  const gestures: string[] = [];
  const unused = (): never => {
    throw new Error('unexpected gesture');
  };
  const ui: Driver = {
    kind: 'pending-opponent',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: unused,
      text: unused,
      tap: async () => {
        if (!received) throw new Error('opponent update has not arrived');
        gestures.push(id);
      },
      expect: {
        hidden: unused,
        text: unused,
        visible: async () => {
          gestures.push(id);
          if (id === 'multiplayer-move-2') received = true;
        },
      },
    }),
  };
  return { ui, gestures };
}

test('the third drop waits for the opponent second move before tapping', async () => {
  // regression: connect-four-journey-opponent-update
  const { ui, gestures } = pendingOpponent();
  await dropConnectFourDisc(ui, 0, 3);
  expect(gestures).toEqual([
    'multiplayer-move-2',
    'connect-four-column-1',
    'multiplayer-move-3',
  ]);
});
