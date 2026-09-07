/**
 * Debounced sticky `latest` snapshot so playground refresh restores session.
 */

import {
  type SnapshotSessionCtx,
  savePlaygroundStickySnapshot,
} from '@apps/product/playground/playground-snapshots';
import type { Timers } from '@pkgs/clock';
import type { PlaygroundSession } from '@pkgs/sim-console/client';

const AUTOSAVE_DEBOUNCE_MS = 1500;

export type StickyAutosaveArgs = {
  readonly session: PlaygroundSession;
  readonly timers: Timers;
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly disposed: () => boolean;
};

/**
 * Debounce domain-wake captures into sticky `latest`, and best-effort flush
 * on `pagehide` / tab hide. Returns a disposer that cancels the timer.
 */
export function installPlaygroundStickyAutosave(
  args: StickyAutosaveArgs
): () => void {
  const { session, timers, snapshotCtx, disposed } = args;
  let timer: ReturnType<Timers['setTimeout']> | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
  };

  const runSave = (): Promise<void> => {
    if (disposed() || stopped || session.snapshotRestoring) {
      return Promise.resolve();
    }
    if (inFlight !== null) return inFlight;
    inFlight = savePlaygroundStickySnapshot(snapshotCtx())
      .then(async () => {
        if (disposed() || stopped) return;
        await session.refreshSnapshotPaletteCommands().catch(() => {});
      })
      .catch(() => {
        // Snapshot store down/slow — next wake retries.
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const schedule = (): void => {
    if (disposed() || stopped || session.snapshotRestoring) return;
    clearTimer();
    timer = timers.setTimeout(() => {
      timer = null;
      void runSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const flush = (): void => {
    clearTimer();
    void runSave();
  };

  const onVisibility = (): void => {
    if (globalThis.document?.visibilityState === 'hidden') flush();
  };

  const unsubWake = session.subscribeDomainWake(() => {
    schedule();
  });

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('pagehide', flush);
    globalThis.document?.addEventListener('visibilitychange', onVisibility);
  }

  // Capture post-boot / post-restore state even if no further domain wakes fire.
  schedule();

  return () => {
    stopped = true;
    clearTimer();
    unsubWake();
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('pagehide', flush);
      globalThis.document?.removeEventListener(
        'visibilitychange',
        onVisibility
      );
    }
  };
}
