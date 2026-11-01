import { expect, test } from 'bun:test';
import { discoverJourneyContent } from '@libs/game-puzzle-harness-ts/content-journey-discovery';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: live-content-discovery-first-page
test('discovery loads the next page before opening the requested edition', async () => {
  let screen = 'page-1';
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const shown = (id: string): boolean =>
    (screen === 'page-1' && id === 'content-more-published') ||
    (screen === 'page-2' &&
      id === 'content-published-cc620be7-d4cb-44c0-9da7-7afebdc5395a');
  const visible = (id: string): void => {
    if (!shown(id)) throw new Error(`${id} is unavailable on ${screen}`);
  };
  const ui: Driver = {
    kind: 'script',
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
      wait: async (state, options) => {
        if (screen === 'loading') screen = 'page-2';
        if (state === 'visible' && options?.visibleOr?.some(shown)) return;
        visible(id);
      },
      isVisible: async () => shown(id),
      text: unused,
      tap: async () => {
        visible(id);
        taps.push(id);
        if (id === 'content-more-published') screen = 'loading';
      },
      expect: {
        visible: async () => visible(id),
        hidden: unused,
        text: unused,
      },
    }),
  };
  await discoverJourneyContent(
    { ui, timeoutMs: 100 },
    'cc620be7-d4cb-44c0-9da7-7afebdc5395a'
  );
  expect(taps).toEqual([
    'content-more-published',
    'content-published-cc620be7-d4cb-44c0-9da7-7afebdc5395a',
  ]);
});
