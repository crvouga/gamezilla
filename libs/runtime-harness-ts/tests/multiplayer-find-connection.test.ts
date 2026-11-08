import { expect, test } from 'bun:test';
import { tapFindOpponent } from '@libs/runtime-harness-ts/multiplayer-journey';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: multiplayer-find-before-screen-mount
test('Find observes connection readiness after the multiplayer screen mounts', async () => {
  let mounted = false;
  let online = false;
  let accepted = false;
  const unused = (): never => {
    throw new Error('Unexpected gesture');
  };
  const ui: Driver = {
    kind: 'mounting-multiplayer',
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
      scroll: unused,
      key: unused,
      isVisible: async () => false,
      text: unused,
      wait: unused,
      tap: async () => {
        // tap auto-waits for Find, mounting the offline screen too late
        // for an earlier negative readiness assertion to have seen it.
        mounted = true;
        accepted = online;
      },
      expect: {
        visible: async () => {
          expect(id).toBe('multiplayer-find');
          mounted = true;
        },
        text: unused,
        hidden: async () => {
          expect(id).toBe('multiplayer-offline');
          if (mounted) online = true;
        },
      },
    }),
  };
  await tapFindOpponent(ui);
  expect(accepted).toBe(true);
});
