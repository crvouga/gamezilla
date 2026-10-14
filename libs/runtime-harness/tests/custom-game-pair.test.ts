import { expect, test } from 'bun:test';
import { prepareCustomGamePair } from '@libs/runtime-harness/custom-game-pair';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

function pair() {
  let publish = () => {};
  const frame = new Promise<void>((resolve) => {
    publish = resolve;
  });
  let waiting = () => {};
  const observed = new Promise<void>((resolve) => {
    waiting = resolve;
  });
  let accepted = false;
  const ready = new Set<string>();
  const unused = (): never => {
    throw new Error('unused gesture');
  };
  const driver = (actor: 'alice' | 'bob'): Driver => ({
    kind: 'pair-example',
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
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: async () => true,
      text: async () => 'TotalDonkey649',
      tap: async () => {
        if (id === 'chess-custom-ready') {
          if (actor === 'alice' && !accepted)
            throw new Error('choices changed');
          ready.add(actor);
        }
      },
      expect: {
        visible: async () => {},
        hidden: async () => {},
        text: async (text) => {
          if (
            actor === 'alice' &&
            id === 'chess-custom-black-person' &&
            text === 'TotalDonkey649'
          ) {
            waiting();
            await frame;
            accepted = true;
          }
          if (text === 'Withdraw readiness' && !ready.has(actor))
            throw new Error('not ready');
        },
      },
    }),
  });
  return {
    publish,
    observed,
    ready,
    host: {
      act: async (_name: string, run: (ui: Driver) => Promise<void>) =>
        run(driver('alice')),
      actAsGuest: async (_name: string, run: (ui: Driver) => Promise<void>) =>
        run(driver('bob')),
    },
  };
}

// regression: custom-game-pair-before-host-sees-acceptance
test('Alice waits for Bob’s accepted seat before submitting readiness', async () => {
  const f = pair();
  const preparing = prepareCustomGamePair(f.host);
  const outcome = preparing.then(
    () => 'ready',
    () => 'failed'
  );
  expect(await Promise.race([f.observed.then(() => 'waiting'), outcome])).toBe(
    'waiting'
  );
  expect(f.ready.size).toBe(0);
  f.publish();
  await preparing;
  expect([...f.ready]).toEqual(['alice', 'bob']);
});
