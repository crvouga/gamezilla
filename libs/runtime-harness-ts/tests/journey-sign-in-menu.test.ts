import { expect, test } from 'bun:test';
import { confirmSignedIn } from '@libs/runtime-harness-ts/journey-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: live-sign-in-menu-closes-during-selection
// regression: journey-account-check-backs-out-of-current-game
test.each([false, true])(
  'account confirmation after menu hydration preserves game context %p',
  async (inGame) => {
    let menu = false;
    let changed = false;
    let account = false;
    let opens = 0;
    let backs = 0;
    const visible = (id: string) =>
      id === Handles.statusCurrentUser ||
      (id === Handles.globalMenuAccount && menu) ||
      (id === Handles.accountSignOut && account) ||
      (id === Handles.navBack && (account || inGame)) ||
      (id === Handles.tabProfile && !account && !inGame);
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
          } else if (id === Handles.navBack) {
            account = false;
            backs++;
          }
        },
        expect: {
          hidden: async () => {
            if (visible(id)) throw new Error(`${id} visible`);
          },
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
    expect(backs).toBe(1);
  }
);
