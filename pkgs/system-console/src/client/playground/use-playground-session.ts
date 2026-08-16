import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlaygroundSession } from '../../shared/ports';

export type PlaygroundSessionState<R = unknown> =
  | { readonly status: 'idle' }
  | { readonly status: 'booting' }
  | { readonly status: 'ready'; readonly session: PlaygroundSession<R> }
  | { readonly status: 'error'; readonly error: string };

export type UsePlaygroundSessionResult<R = unknown> = {
  readonly state: PlaygroundSessionState<R>;
  /** Clear durable OPFS + namespaced auth/KV (does not remount). */
  readonly wipe: () => Promise<void>;
  /** Remount a fresh session after {@link wipe}. */
  readonly reboot: () => void;
};

/**
 * Boot a playground session while `active`, disposing it on unmount
 * or when `active` becomes false. There are no wall fallbacks — a missing /
 * failing boot surfaces an error state.
 *
 * OPFS / namespaced localStorage survive page refresh; {@link wipe} +
 * {@link reboot} clear them and remount a clean session.
 *
 * Boots are serialized through {@link disposeGate}: React Strict Mode remounts
 * wait for the prior in-flight boot to finish and dispose before opening OPFS
 * again (avoids AccessHandle / "Error finalizing statement" races).
 */
export function usePlaygroundSession<R>(
  bootPlayground: () => Promise<PlaygroundSession<R>>,
  active: boolean
): UsePlaygroundSessionResult<R> {
  const [state, setState] = useState<PlaygroundSessionState<R>>({
    status: 'idle',
  });
  const [bootGeneration, setBootGeneration] = useState(0);
  const liveRef = useRef<PlaygroundSession<R> | null>(null);
  const disposeGate = useRef(Promise.resolve());

  useEffect(() => {
    if (!active) {
      liveRef.current = null;
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let live: PlaygroundSession<R> | null = null;
    setState({ status: 'booting' });

    const run = disposeGate.current.then(async () => {
      if (cancelled) return;
      try {
        const session = await bootPlayground();
        if (cancelled) {
          await session.dispose();
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
      disposeGate.current = run.then(async () => {
        if (live !== null) await live.dispose();
      });
    };
  }, [bootPlayground, active, bootGeneration]);

  const wipe = useCallback(async () => {
    const current = liveRef.current;
    liveRef.current = null;
    if (current !== null) {
      await current.wipe();
    }
  }, []);

  const reboot = useCallback(() => {
    setState({ status: 'booting' });
    setBootGeneration((n) => n + 1);
  }, []);

  return { state, wipe, reboot };
}
