import { useEffect, useState } from 'react';

import type { PlaygroundSession } from '../../shared/ports';

export type PlaygroundSessionState<R = unknown> =
  | { readonly status: 'idle' }
  | { readonly status: 'booting' }
  | { readonly status: 'ready'; readonly session: PlaygroundSession<R> }
  | { readonly status: 'error'; readonly error: string };

/**
 * Boot a two-actor playground session while `active`, disposing it on unmount
 * or when `active` becomes false. There are no wall fallbacks — a missing /
 * failing boot surfaces an error state.
 */
export function usePlaygroundSession<R>(
  bootPlayground: () => Promise<PlaygroundSession<R>>,
  active: boolean
): PlaygroundSessionState<R> {
  const [state, setState] = useState<PlaygroundSessionState<R>>({
    status: 'idle',
  });

  useEffect(() => {
    if (!active) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let live: PlaygroundSession<R> | null = null;
    setState({ status: 'booting' });
    void (async () => {
      try {
        const session = await bootPlayground();
        if (cancelled) {
          void session.dispose();
          return;
        }
        live = session;
        setState({ status: 'ready', session });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
      if (live) void live.dispose();
    };
  }, [bootPlayground, active]);

  return state;
}
