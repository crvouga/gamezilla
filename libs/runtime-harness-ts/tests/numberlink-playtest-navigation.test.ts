import { expect, test } from 'bun:test';
import { drawNumberlinkJourneyRow } from '@libs/numberlink-harness-ts/numberlink-journey-board';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

function openingPlaytest(appears: boolean) {
  let screen = 'editor';
  const keys: string[] = [];
  const saved: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const node = (path: string[]): DriverNode => ({
    get: (id) => node([...path, id]),
    attribute: unused,
    tap: unused,
    tapAt: unused,
    drag: unused,
    layout: unused,
    selectFile: unused,
    input: unused,
    clear: unused,
    scroll: unused,
    text: unused,
    isVisible: unused,
    wait: async () => {
      if (path.includes('content-attempt')) {
        if (!appears) throw new Error('Playtest did not open');
        screen = 'player';
      }
      // The editor also has enabled numberlink-board-cell-* controls.
    },
    key: async (key) => {
      keys.push(`${screen}:${path.at(-1)}:${key}`);
    },
    expect: {
      visible: unused,
      hidden: unused,
      text: async () => {
        saved.push(screen);
      },
    },
  });
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id) => node([id]),
  };
  return { ui, keys, saved };
}

// regression: numberlink-playtest-keys-reach-editor-before-navigation
test('Numberlink drawing waits for the playtest instead of using the departing editor cells', async () => {
  const fixture = openingPlaytest(true);
  await drawNumberlinkJourneyRow({ ui: fixture.ui, timeoutMs: 20_000 }, 0);
  expect(fixture.keys).toEqual([
    'player:numberlink-board-cell-0:enter',
    'player:numberlink-board-cell-0:arrowRight',
    'player:numberlink-board-cell-1:arrowRight',
    'player:numberlink-board-cell-2:enter',
  ]);
  expect(fixture.saved).toEqual(['player']);
});

test('Numberlink drawing sends no keys if the playtest never replaces the editor', async () => {
  const fixture = openingPlaytest(false);
  await expect(
    drawNumberlinkJourneyRow({ ui: fixture.ui, timeoutMs: 20_000 }, 0)
  ).rejects.toThrow('Playtest did not open');
  expect(fixture.keys).toEqual([]);
  expect(fixture.saved).toEqual([]);
});
