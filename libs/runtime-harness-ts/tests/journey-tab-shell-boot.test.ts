import { expect, test } from 'bun:test';
import { confirmSignedIn } from '@libs/runtime-harness-ts/journey-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: journey-tab-shell-tapped-under-boot-overlay
test('a relaunched device is not tapped until its boot overlay is gone', async () => {
  // The header's account control is visible while the boot overlay still
  // covers the viewport; a tap then lands on the overlay.
  let booting = true;
  let tappedWhileBooting = false;
  const unused = (): never => {
    throw new Error('unexpected gesture');
  };
  const visible = (id: string) =>
    id === Handles.statusCurrentUser ||
    (id === Handles.bootLoading && booting) ||
    id === Handles.globalMenuAccount ||
    id === Handles.accountSignOut ||
    id === Handles.navBack;
  const ui: Driver = {
    kind: 'booting-device',
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
      text: unused,
      isVisible: async () => visible(id),
      tap: async () => {
        if (booting) tappedWhileBooting = true;
      },
      expect: {
        hidden: async () => {
          if (id === Handles.bootLoading) booting = false;
          if (visible(id)) throw new Error(`${id} visible`);
        },
        text: unused,
        visible: async () => {
          if (!visible(id)) throw new Error(`${id} hidden`);
        },
      },
    }),
  };
  await confirmSignedIn(ui).catch(() => undefined);
  expect(tappedWhileBooting).toBe(false);
});
