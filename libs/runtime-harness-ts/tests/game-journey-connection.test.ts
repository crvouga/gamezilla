import { expect, test } from 'bun:test';
import { CONNECT_FOUR_PLAYABLE } from '@libs/connect-four-harness-ts/connect-four-playable';
import { playJourneyMove } from '@libs/runtime-harness-ts/game-journey';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

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
      scroll: unused,
      wait: async () => {
        gestures.push(`${id}:enabled`);
      },
      isVisible: unused,
      text: unused,
      tap: unused,
      key: async () => {
        if (!received) throw new Error('opponent update has not arrived');
        gestures.push(id);
      },
      expect: {
        hidden: async () => {
          gestures.push(`${id}:hidden`);
        },
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

test('the third move waits for the opponent second move before its gesture', async () => {
  // regression: connect-four-journey-opponent-update
  const { ui, gestures } = pendingOpponent();
  await playJourneyMove(ui, CONNECT_FOUR_PLAYABLE, '0', 3);
  expect(gestures).toEqual([
    'multiplayer-move-2',
    'multiplayer-offline:hidden',
    'multiplayer-board-column-1:enabled',
    'multiplayer-board-column-1',
    'multiplayer-move-3',
  ]);
});

test('visible history does not trigger a drop while its column is still disabled', async () => {
  // regression: connect-four-journey-pending-column
  const { ui, gestures } = pendingOpponent();
  const get = ui.get.bind(ui);
  let enabled = false;
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      wait: async () => {
        enabled = true;
        gestures.push(`${id}:enabled`);
      },
      key: async (key) => {
        if (!enabled)
          throw new Error(
            'The column is visible but the turn is still pending'
          );
        await node.key(key);
      },
    };
  };
  await playJourneyMove(ui, CONNECT_FOUR_PLAYABLE, '0', 3);
  expect(gestures).toEqual([
    'multiplayer-move-2',
    'multiplayer-offline:hidden',
    'multiplayer-board-column-1:enabled',
    'multiplayer-board-column-1',
    'multiplayer-move-3',
  ]);
});

// regression: live-journey-command-before-reconnection
test('a move waits for reconnection even after its opponent move is visible', async () => {
  const { ui } = pendingOpponent();
  const get = ui.get.bind(ui);
  let online = false;
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      key: async (key) => {
        if (!online) throw new Error('This action needs a connection.');
        await node.key(key);
      },
      expect: {
        ...node.expect,
        hidden: async () => {
          if (id === 'multiplayer-offline') online = true;
        },
      },
    };
  };
  await playJourneyMove(ui, CONNECT_FOUR_PLAYABLE, '0', 3);
  expect(online).toBe(true);
});
