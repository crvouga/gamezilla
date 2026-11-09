import { expect, test } from 'bun:test';
import { openGlobalMenu } from '@libs/harness-ts/driver-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: global-menu-late-open-backdrop
test('waits for Account when its open menu arrives after the visibility read', async () => {
  const taps: string[] = [];
  const waits: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected gesture');
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: async (name) => (name === 'aria-expanded' ? 'true' : null),
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: async () => false,
      text: unused,
      tap: async () => {
        taps.push(id);
        throw new Error('Open menu backdrop covers the avatar');
      },
      expect: {
        visible: async () => {
          waits.push(id);
        },
        hidden: unused,
        text: unused,
      },
    }),
  };
  await openGlobalMenu(ui, Handles.globalMenuAccount, 20_000);
  expect(taps).toEqual([]);
  expect(waits).toEqual([Handles.globalMenuAccount]);
});

// regression: global-menu-tap-hits-boot-remount
test('taps the avatar again once a boot remount under the first tap has finished', async () => {
  let booting = false;
  let menuOpen = false;
  let avatarTaps = 0;
  const unused = (): never => {
    throw new Error('Unexpected gesture');
  };
  const visible = (id: string): boolean =>
    (id === Handles.bootLoading && booting) ||
    (id === Handles.globalMenuAccount && menuOpen);
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: async () => null,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: async () => visible(id),
      text: unused,
      tap: async () => {
        if (id !== Handles.statusCurrentUser) throw new Error(`tap ${id}`);
        avatarTaps += 1;
        if (avatarTaps === 1) {
          // The reconnecting app remounts under its boot overlay mid-tap.
          booting = true;
          throw new Error('trusted click missed; hit boot-loading');
        }
        menuOpen = true;
      },
      expect: {
        visible: async () => {
          if (!visible(id)) throw new Error(`${id} hidden`);
        },
        hidden: async () => {
          if (id === Handles.bootLoading) booting = false;
        },
        text: unused,
      },
    }),
  };
  await openGlobalMenu(ui, Handles.globalMenuAccount, 20_000);
  expect(avatarTaps).toBe(2);
  expect(menuOpen).toBe(true);
});
