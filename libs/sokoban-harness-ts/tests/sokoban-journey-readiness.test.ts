import { expect, test } from 'bun:test';
import { pushSokobanJourneyRight } from '@libs/sokoban-harness-ts/sokoban-journey-board';

type Device = Parameters<typeof pushSokobanJourneyRight>[0];

function loadingDevice(ready: Promise<void>) {
  let visible = false;
  const keys: string[] = [];
  const saved: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const ui: Device['ui'] = {
    kind: 'delayed-board',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id) => ({
      get: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      scroll: unused,
      text: unused,
      attribute: unused,
      isVisible: unused,
      wait: unused,
      tap: unused,
      key: async (key) => {
        if (id !== 'sokoban-board' || !visible)
          throw new Error('Keyboard target not found');
        keys.push(key);
      },
      expect: {
        hidden: unused,
        visible: async (options) => {
          expect(id).toBe('sokoban-board');
          expect(options?.timeoutMs).toBe(1234);
          await ready;
          visible = true;
        },
        text: async (text) => {
          expect(id).toBe('content-position-save-status');
          expect(keys).toEqual(['arrowRight']);
          saved.push(text);
        },
      },
    }),
  };
  return { device: { ui, timeoutMs: 1234 }, keys, saved };
}

// regression: sokoban-journey-key-before-board-ready
test('opening a playtest waits for the requested board before its first move', async () => {
  const ready = Promise.withResolvers<void>();
  const { device, keys, saved } = loadingDevice(ready.promise);
  const move = pushSokobanJourneyRight(device);
  expect(keys).toEqual([]);
  expect(saved).toEqual([]);
  ready.resolve();
  await move;
  expect(keys).toEqual(['arrowRight']);
  expect(saved).toEqual(['Progress saved on this device.']);
});

test('an unavailable board fails the journey without sending a move', async () => {
  const ready = Promise.withResolvers<void>();
  const { device, keys, saved } = loadingDevice(ready.promise);
  const move = pushSokobanJourneyRight(device);
  ready.reject(new Error('Board unavailable'));
  await expect(move).rejects.toThrow('Board unavailable');
  expect(keys).toEqual([]);
  expect(saved).toEqual([]);
});
