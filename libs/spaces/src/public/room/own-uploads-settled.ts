import type { Timers } from '@pkgs/clock';

/** How long a room connection waits for this device's writes to upload. */
const SETTLE_MAX_MS = 6_000;
const SETTLE_POLL_MS = 100;

type UploadQueue = {
  readonly pendingMutationCount: () => Promise<number>;
  readonly wakeUploads: () => void;
};

function sleep(timers: Timers, ms: number): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

/**
 * Resolves once this device has no writes waiting to upload, or after
 * {@link SETTLE_MAX_MS} (offline: the socket will not open anyway).
 *
 * The room gateway decides what the actor may do in a space's room from the
 * server's rows when the socket opens, so a host whose space is still on its
 * way to the server (created a moment ago, or offline) must not open the
 * socket before it lands — or the room would admit them without the host's
 * grants for the life of the connection.
 */
export async function ownUploadsSettled(
  queue: UploadQueue,
  timers: Timers
): Promise<void> {
  queue.wakeUploads();
  for (let waited = 0; waited < SETTLE_MAX_MS; waited += SETTLE_POLL_MS) {
    if ((await queue.pendingMutationCount()) === 0) return;
    await sleep(timers, SETTLE_POLL_MS);
  }
}
