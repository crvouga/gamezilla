// regression: journey-back-waits-on-missing-nav
import { describe, expect, test } from 'bun:test';
import { pressBackUntilVisible } from '@libs/harness/system/driver-gestures';
import type { Driver, DriverNode } from '@pkgs/ui-testing';

function node(args: {
  readonly id: string;
  readonly visible: () => boolean;
  readonly onVisible: (id: string) => void;
  readonly onTap: (id: string) => void;
}): DriverNode {
  const self: DriverNode = {
    get: (child) =>
      node({
        id: child,
        visible: args.visible,
        onVisible: args.onVisible,
        onTap: args.onTap,
      }),
    tap: async () => {
      if (!args.visible()) throw new Error(`${args.id} is not visible`);
      args.onTap(args.id);
    },
    tapAt: () => Promise.reject(new Error('unused')),
    drag: () => Promise.reject(new Error('unused')),
    layout: () => Promise.resolve(null),
    input: () => Promise.reject(new Error('unused')),
    clear: () => Promise.reject(new Error('unused')),
    key: () => Promise.reject(new Error('unused')),
    scroll: () => Promise.reject(new Error('unused')),
    wait: () => Promise.resolve(),
    expect: {
      visible: () => {
        args.onVisible(args.id);
        if (!args.visible()) throw new Error(`${args.id} is not visible`);
        return Promise.resolve();
      },
      hidden: () => Promise.resolve(),
      text: () => Promise.resolve(),
    },
    isVisible: () => Promise.resolve(args.visible()),
    text: () => Promise.resolve(null),
  };
  return self;
}

describe('pressBackUntilVisible', () => {
  test('waits for the screen when there is no back control', async () => {
    let goal = false;
    const taps: string[] = [];
    const ui: Driver = {
      kind: 'script',
      launch: () => Promise.resolve(),
      close: () => Promise.resolve(),
      key: () => Promise.reject(new Error('unused')),
      snapshotHtml: () => Promise.resolve(null),
      get: (id) =>
        node({
          id,
          visible: () => (id === 'goal' ? goal : false),
          onVisible: (waited) => {
            if (waited === 'goal') goal = true;
          },
          onTap: (tapped) => {
            taps.push(tapped);
          },
        }),
    };
    await pressBackUntilVisible(ui, 'goal', 20);
    expect(taps).toEqual([]);
    expect(goal).toBe(true);
  });
});
