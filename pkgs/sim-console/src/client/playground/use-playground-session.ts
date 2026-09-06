import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

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
  readonly wipe: () => Promise<void>;
  readonly reboot: () => void;
};

/** Serialize teardown and boot so SQLite handles never overlap. */
export function usePlaygroundSession(
  bootPlayground: (opts?: BootPlaygroundOptions) => Promise<PlaygroundSession>,
  active: Accessor<boolean>
): UsePlaygroundSessionResult {
  const [state, setState] = createSignal<PlaygroundSessionState>({
    status: 'idle',
  });
  const [generation, setGeneration] = createSignal(0);
  let current: PlaygroundSession | null = null;
  let disposeGate = Promise.resolve();
  let skipSnapshotLoad = false;
  createEffect(() => {
    generation();
    if (!active()) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let live: PlaygroundSession | null = null;
    setState({ status: 'booting' });
    const skip = skipSnapshotLoad;
    skipSnapshotLoad = false;
    const run = disposeGate.then(async () => {
      if (cancelled) return;
      try {
        const session = await bootPlayground(
          skip ? { skipSnapshotLoad: true } : undefined
        );
        if (cancelled) {
          await session.dispose().catch(() => {});
          return;
        }
        live = session;
        current = session;
        setState({ status: 'ready', session });
      } catch (err) {
        if (!cancelled)
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
      }
    });
    onCleanup(() => {
      cancelled = true;
      current = null;
      disposeGate = run
        .then(async () => {
          if (live !== null) await live.dispose();
        })
        .catch(() => {});
    });
  });
  return {
    get state() {
      return state();
    },
    async wipe() {
      skipSnapshotLoad = true;
      const live = current;
      current = null;
      setState({ status: 'booting' });
      if (live !== null) {
        disposeGate = disposeGate.then(() => live.wipe()).catch(() => {});
        await disposeGate;
      }
    },
    reboot() {
      setGeneration((n) => n + 1);
    },
  };
}
