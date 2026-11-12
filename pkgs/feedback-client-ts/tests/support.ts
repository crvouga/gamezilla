import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createDebugBuffer } from '@pkgs/feedback-shared-ts/debug-buffer';
import type {
  BugReportSubmission,
  ScreenshotFile,
} from '@pkgs/feedback-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { BugReportController, type ChosenPicture } from '../src/controller';
import type { SendOutcome } from '../src/sender';
import { BugReportStorage } from '../src/storage';

export const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** Lets everything already asked for run, without moving the clock. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function chosen(
  bytes: Uint8Array = PNG,
  read: () => Promise<Uint8Array> = () => Promise.resolve(bytes)
): ChosenPicture {
  return { contentType: 'image/png', size: bytes.byteLength, read };
}

export type Sent = {
  readonly submission: BugReportSubmission;
  readonly pictures: readonly ScreenshotFile[];
};

/** A device with bug reporting on it, and a team whose answers the test chooses. */
export function createDevice(store = new ObjectStoreImplInMemory()) {
  const { clock, timers } = createHarnessClock({ startMs: 1_700_000_000_000 });
  const sent: Sent[] = [];
  const world = {
    store,
    clock,
    sent,
    answer: 'sent' as SendOutcome,
    capture: (): Promise<ScreenshotFile | null> =>
      Promise.resolve({ contentType: 'image/png', bytes: PNG }),
  };
  let ids = 0;
  const createId = (): string => `id-${++ids}-${clock.now()}`;
  const controller = new BugReportController({
    storage: new BugReportStorage(store, createId),
    send(submission, pictures) {
      sent.push({ submission, pictures });
      return Promise.resolve(world.answer);
    },
    screenshot: { capture: () => world.capture() },
    connection: { online: () => true, subscribe: () => () => undefined },
    debug: createDebugBuffer({ clock }),
    providers: () => [],
    clock,
    timers,
    createId,
  });
  return Object.assign(world, { controller });
}
