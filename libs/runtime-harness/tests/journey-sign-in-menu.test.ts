import { expect, test } from 'bun:test';
import { confirmSignedIn } from '@libs/runtime-harness/journey-gestures';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

// regression: live-sign-in-menu-closes-during-selection
test('sign-in confirmation reopens a menu closed by hydration before the Account tap', async () => {
  let menu = false;
  let changed = false;
  let account = false;
  let opens = 0;
  const visible = (id: string) =>
    id === Handles.statusCurrentUser ||
    (id === Handles.globalMenuAccount && menu) ||
    (id === Handles.accountSignOut && account) ||
    (id === Handles.navBack && account) ||
    (id === Handles.tabProfile && !account);
  const unused = (): never => {
    throw new Error('unexpected gesture');
  };
  const ui: Driver = {
    kind: 'hydrating-menu',
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
      text: unused,
      isVisible: async () => visible(id),
      tap: async () => {
        if (id === Handles.statusCurrentUser) {
          menu = true;
          opens++;
        } else if (id === Handles.globalMenuAccount) {
          menu = false;
          if (!changed) {
            changed = true;
            throw new Error('menu closed during hydration');
          }
          account = true;
        } else if (id === Handles.navBack) account = false;
      },
      expect: {
        hidden: unused,
        text: unused,
        visible: async () => {
          if (!visible(id)) throw new Error(`${id} hidden`);
        },
      },
    }),
  };
  await confirmSignedIn(ui);
  expect(opens).toBe(2);
  expect(changed).toBe(true);
  expect(account).toBe(false);
});
