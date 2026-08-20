import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  BootPlaygroundOptions,
  PlaygroundSession,
} from '../../shared/ports';

export type PlaygroundSessionState =
  | { readonly status: 'idle' }
  | { readonly status: 'booting' }
  | { readonly status: 'ready'; readonly session: PlaygroundSession }
  | { readonly status: 'error'; readonly error: string };

export type UsePlaygroundSessionResult = {
  readonly state: PlaygroundSessionState;
  /** Tear down the live session; next {@link reboot} skips snapshot auto-load. */
  readonly wipe: () => Promise<void>;
  /** Remount a fresh session after {@link wipe}. */
  readonly reboot: () => void;
};

/**
 * Boot a playground session while `active`, disposing it on unmount
 * or when `active` becomes false. There are no wall fallbacks — a missing /
 * failing boot surfaces an error state.
 *
 * Live SQL/auth/KV are ephemeral. ObjectStore snapshots are the only durable
 * state; boot auto-loads the newest snapshot unless {@link wipe} set
 * `skipSnapshotLoad` for the next reboot.
 *
 * Boots are serialized through {@link disposeGate}: React Strict Mode remounts
 * wait for the prior in-flight boot to finish and dispose before opening SQLite
 * again (avoids AccessHandle / "Error finalizing statement" races).
 */
export function usePlaygroundSession(
  bootPlayground: (opts?: BootPlaygroundOptions) => Promise<PlaygroundSession>,
  active: boolean
): UsePlaygroundSessionResult {
  const [state, setState] = useState<PlaygroundSessionState>({
    status: 'idle',
  });
  const [bootGeneration, setBootGeneration] = useState(0);
  const liveRef = useRef<PlaygroundSession | null>(null);
  const disposeGate = useRef(Promise.resolve());
  const skipSnapshotLoadRef = useRef(false);

  useEffect(() => {
    if (!active) {
      liveRef.current = null;
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let live: PlaygroundSession | null = null;
    setState({ status: 'booting' });
    const skipSnapshotLoad = skipSnapshotLoadRef.current;
    skipSnapshotLoadRef.current = false;

    const run = disposeGate.current.then(async () => {
      if (cancelled) return;
      try {
        const session = await bootPlayground(
          skipSnapshotLoad ? { skipSnapshotLoad: true } : undefined
        );
        if (cancelled) {
          await session.dispose().catch(() => {});
          return;
        }
        live = session;
        liveRef.current = session;
        setState({ status: 'ready', session });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    return () => {
      cancelled = true;
      liveRef.current = null;
      disposeGate.current = run
        .then(async () => {
          if (live !== null) await live.dispose();
        })
        .catch(() => {
          // Teardown races (already-wiped World) must not crash the console.
        });
    };
  }, [bootPlayground, active, bootGeneration]);

  const wipe = useCallback(async () => {
    skipSnapshotLoadRef.current = true;
    const current = liveRef.current;
    liveRef.current = null;
    setState({ status: 'booting' });
    if (current !== null) {
      try {
        await current.wipe();
      } catch {
        // Live World may already be partially torn down.
      }
    }
  }, []);

  const reboot = useCallback(() => {
    setState({ status: 'booting' });
    setBootGeneration((n) => n + 1);
  }, []);

  return { state, wipe, reboot };
}
