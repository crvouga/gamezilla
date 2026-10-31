import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { turnSoundsOff } from '@libs/runtime-harness-ts/app-settings';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** The 1180×820 tablet's Appearance screen offers global chrome, not compact back controls. */
function tabletOnAppearance() {
  let path = '/more/theme';
  let menu = false;
  let muted = false;
  const visible = (id: string): boolean =>
    id === Handles.statusCurrentUser ||
    (id === Handles.globalMenuSettings && menu) ||
    (path === '/more' &&
      [Handles.settingsTheme, Handles.settingsSound].some(
        (entry) => entry === id
      )) ||
    (path === '/more/sound' && id === Handles.soundEffectsSwitch);
  const requireVisible = (id: string): void => {
    if (!visible(id)) throw new Error(`${id} is not offered at ${path}`);
  };
  const ui = {
    get: (id: string) => ({
      isVisible: async () => visible(id),
      tap: async () => {
        requireVisible(id);
        if (id === Handles.statusCurrentUser) menu = true;
        if (id === Handles.globalMenuSettings) {
          path = '/more';
          menu = false;
        }
        if (id === Handles.settingsSound) path = '/more/sound';
        if (id === Handles.soundEffectsSwitch) muted = true;
      },
      expect: { visible: async () => requireVisible(id) },
    }),
  };
  const s = {
    actors: new Map([['alice', { ui, currentPath: async () => path }]]),
    session: { waitForIdle: async () => {} },
  } as unknown as ProductHarness;
  return { s, muted: () => muted };
}

// regression: tablet-settings-compact-navigation-detour
test('the settings harness can leave tablet Appearance through the global menu', async () => {
  const tablet = tabletOnAppearance();
  await Promise.resolve(turnSoundsOff.act(tablet.s, 'alice'));
  expect(tablet.muted()).toBe(true);
});
