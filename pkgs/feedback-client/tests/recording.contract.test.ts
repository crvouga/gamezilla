import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createReproductionRecorder } from '@pkgs/feedback-client/recording';
import type { EvidenceFile } from '@pkgs/feedback-shared/types';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const action = {
  type: 'click' as const,
  path: '/chess',
  target: '[data-testid="hint"]',
  label: 'Hint',
  value: null,
  point: null,
};
const file: EvidenceFile = {
  name: 'reproduction.webm',
  contentType: 'video/webm',
  bytes: new Uint8Array([1, 2, 3]),
};
async function microtasks() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

test('explicit recording bounds actions and releases the deadline after stopping', async () => {
  await assertProperty(
    'feedback-recording',
    fc.asyncProperty(fc.integer({ min: 0, max: 400 }), async (count) => {
      const { clock, timers } = createHarnessClock();
      const recorder = createReproductionRecorder({
        clock,
        timers,
        captureContext: async () => [],
        video: null,
      });
      recorder.record(action);
      expect(recorder.state().recording).toBeNull();
      await recorder.start();
      for (let i = 0; i < count; i++) recorder.record(action);
      clock.advance(200);
      await recorder.stop();
      expect(recorder.state().recording?.actions.length).toBeLessThanOrEqual(
        200
      );
      expect(
        new TextEncoder().encode(
          JSON.stringify(recorder.state().recording?.actions)
        ).length
      ).toBeLessThan(33_000);
      expect(recorder.state().recording?.durationMs).toBe(200);
      expect(clock.pendingOneShotCount()).toBe(0);
      recorder.discard();
      expect(recorder.state().recording).toBeNull();
    })
  );
});

// regression: feedback-recording-stale-stop
test('a discarded stop cannot dispose or overwrite a newly started recording', async () => {
  const { clock, timers } = createHarnessClock();
  let finish: ((value: EvidenceFile) => void) | undefined;
  let sessions = 0;
  const disposed: number[] = [];
  const recorder = createReproductionRecorder({
    clock,
    timers,
    captureContext: async () => [],
    video: {
      start: async () => {
        const id = ++sessions;
        return {
          stop: () =>
            new Promise<EvidenceFile>((resolve) => {
              finish = resolve;
            }),
          dispose: () => {
            disposed.push(id);
          },
        };
      },
    },
  });
  await recorder.start();
  const stopping = recorder.stop();
  recorder.discard();
  await recorder.start();
  finish?.(file);
  await stopping;
  expect(recorder.state().phase).toBe('recording');
  expect(disposed).not.toContain(2);
  recorder.dispose();
  expect(disposed).toContain(2);
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('unresponsive video finishing still returns a reviewable action recording', async () => {
  const { clock, timers } = createHarnessClock();
  const recorder = createReproductionRecorder({
    clock,
    timers,
    captureContext: async () => [],
    video: {
      start: async () => ({ stop: () => new Promise(() => {}), dispose() {} }),
    },
  });
  await recorder.start();
  recorder.record(action);
  const stopping = recorder.stop();
  clock.advance(3500);
  await microtasks();
  await stopping;
  expect(recorder.state().phase).toBe('ready');
  expect(recorder.state().recording?.actions).toHaveLength(1);
  expect(recorder.state().video).toBeNull();
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('a screen permission result arriving after discard is immediately released', async () => {
  const { clock, timers } = createHarnessClock();
  let release:
    | ((value: {
        stop: () => Promise<EvidenceFile>;
        dispose: () => void;
      }) => void)
    | undefined;
  let disposed = false;
  const recorder = createReproductionRecorder({
    clock,
    timers,
    captureContext: async () => [],
    video: {
      start: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  });
  const starting = recorder.start();
  recorder.discard();
  release?.({
    stop: async () => file,
    dispose: () => {
      disposed = true;
    },
  });
  await starting;
  expect(disposed).toBe(true);
  expect(recorder.state().phase).toBe('idle');
  expect(clock.pendingOneShotCount()).toBe(0);
});

// regression: feedback-context-before-screen-permission
test('starting context reflects the position after the screen chooser closes', async () => {
  const { clock, timers } = createHarnessClock();
  let position = 'Before choosing the app tab';
  let release:
    | ((value: {
        stop: () => Promise<EvidenceFile>;
        dispose: () => void;
      }) => void)
    | undefined;
  const recorder = createReproductionRecorder({
    clock,
    timers,
    captureContext: async () => [
      { name: 'position', status: 'available', value: position },
    ],
    video: {
      start: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  });
  const starting = recorder.start();
  await microtasks();
  position = 'After choosing the app tab';
  release?.({ stop: async () => file, dispose() {} });
  await starting;
  expect(recorder.state().recording?.initialContext).toEqual([
    {
      name: 'position',
      status: 'available',
      value: 'After choosing the app tab',
    },
  ]);
  recorder.dispose();
});
