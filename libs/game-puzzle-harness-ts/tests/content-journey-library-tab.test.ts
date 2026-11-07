import { expect, test } from 'bun:test';
import { contentTap } from '@libs/game-puzzle-harness-ts/content-journey-device';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: numberlink-draft-hidden-library-tab
test('opens Your work before the Numberlink draft retained under its hidden panel', async () => {
  const draft = 'content-draft-ffcf8f02-68a8-421c-a9b8-f92873bbaa61';
  const mine = 'content-library-tab-mine';
  let selected = 'content-library-tab-browse';
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      text: unused,
      attribute: async (name) =>
        name === 'aria-selected' ? String(id === selected) : null,
      // The element has no own hidden style, but its unselected panel is hidden.
      isVisible: async () => id === draft || id === mine,
      wait: async () => {},
      tap: async () => {
        if (id === draft && selected !== mine)
          throw new Error('draft has a zero-sized hidden ancestor');
        taps.push(id);
        if (id === mine) selected = mine;
      },
      expect: { visible: unused, hidden: unused, text: unused },
    }),
  };
  await contentTap({ ui, timeoutMs: 100 }, draft);
  expect(taps).toEqual([mine, draft]);
});
