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

type BootOutcome =
  | { readonly ok: true; readonly session: PlaygroundSession }
  | { readonly ok: false; readonly error: string }
  | null;

async function bootSession(args: {
  readonly boot: (opts?: BootPlaygroundOptions) => Promise<PlaygroundSession>;
  readonly skip: boolean;
  readonly isCancelled: () => boolean;
}): Promise<BootOutcome> {
  if (args.isCancelled()) return null;
  try {
    const session = await args.boot(
      args.skip ? { skipSnapshotLoad: true } : undefined
    );
    return { ok: true, session };
  } catch (err) {
    if (args.isCancelled()) return null;
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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
    const isCancelled = () => cancelled;
    const run = disposeGate.then(async () => {
      const outcome = await bootSession({
        boot: bootPlayground,
        skip,
        isCancelled,
      });
      if (outcome === null) return;
      if (!outcome.ok) {
        setState({ status: 'error', error: outcome.error });
        return;
      }
      if (isCancelled()) {
        await outcome.session.dispose().catch(() => {});
        return;
      }
      live = outcome.session;
      current = outcome.session;
      setState({ status: 'ready', session: outcome.session });
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
