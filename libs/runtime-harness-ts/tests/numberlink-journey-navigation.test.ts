import { expect, test } from 'bun:test';
import { openNumberlinkSpace } from '@libs/runtime-harness-ts/numberlink-journey-navigation';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: numberlink-journey-saved-space-opens-game-menu
// regression: numberlink-journey-checks-before-library-hydration
// regression: content-library-restored-during-game-selection
test.each([
  'games',
  'numberlink',
  'library',
  'loading-library',
  'restoring-game',
  'restoring-choice',
  'missing-choice',
])(
  'a reopened space landing on %s verifies the Numberlink destination',
  async (landing) => {
    let screen = 'previous-attempt';
    const unused = (): never => {
      throw new Error('Unexpected driver operation');
    };
    const shown = (id: string): boolean =>
      (['games', 'restoring-game'].includes(screen) &&
        id === Handles.gameMenu('numberlink')) ||
      (['numberlink', 'restoring-choice', 'missing-choice'].includes(screen) &&
        id === Handles.gameChoice('puzzle-library')) ||
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
        wait: async (state, options) => {
          if (screen === 'loading-library') screen = 'library';
          if (state === 'visible' && options?.visibleOr?.some(shown)) return;
          visible(id);
        },
        isVisible: async () => shown(id),
        text: unused,
        tap: async () => {
          if (screen === 'restoring-choice') {
            screen = 'library';
            throw new Error('the element is gone');
          }
          if (screen === 'missing-choice')
            throw new Error('the element is gone');
          visible(id);
          // Hydration may restore the saved library during the game-menu tap.
          screen = screen === 'games' ? 'numberlink' : 'library';
        },
        expect: {
          visible: async () => visible(id),
          hidden: unused,
          text: unused,
        },
      }),
    };
    const opening = openNumberlinkSpace(
      {
        openLink: async (link) => {
          expect(link).toBe('/space/saved-numberlink-space');
          screen = landing;
        },
        act: async (_name, gestures) => gestures(ui),
      },
      '/space/saved-numberlink-space'
    );
    if (landing === 'missing-choice') {
      await expect(opening).rejects.toThrow('the element is gone');
    } else {
      await opening;
      expect(await ui.get('content-create-puzzle').isVisible()).toBe(true);
    }
  }
);
