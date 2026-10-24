import { expect, test } from 'bun:test';
import { openNumberlinkSpace } from '@libs/runtime-harness-ts/numberlink-journey-navigation';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: numberlink-journey-saved-space-opens-game-menu
test('a reopened space selects Numberlink before looking for saved work', async () => {
  let screen = 'previous-attempt';
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const shown = (id: string): boolean =>
    (screen === 'games' && id === Handles.gameMenu('numberlink')) ||
    (screen === 'numberlink' && id === Handles.gameChoice('puzzle-library')) ||
    (screen === 'library' && id === 'content-create-puzzle');
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
      wait: async () => visible(id),
      isVisible: async () => shown(id),
      text: unused,
      tap: async () => {
        visible(id);
        screen = screen === 'games' ? 'numberlink' : 'library';
      },
      expect: {
        visible: async () => visible(id),
        hidden: unused,
        text: unused,
      },
    }),
  };
  await openNumberlinkSpace(
    {
      openLink: async (link) => {
        expect(link).toBe('/space/saved-numberlink-space');
        screen = 'games';
      },
      act: async (_name, gestures) => gestures(ui),
    },
    '/space/saved-numberlink-space'
  );
  expect(await ui.get('content-create-puzzle').isVisible()).toBe(true);
});
