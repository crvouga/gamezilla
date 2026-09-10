import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

import type {
  BootProductSimulatorOptions,
  ProductSimulatorSession,
} from '../../shared/ports';

export type ProductSimulatorSessionState =
  | { readonly status: 'idle' }
  | { readonly status: 'booting' }
  | { readonly status: 'ready'; readonly session: ProductSimulatorSession }
  | { readonly status: 'error'; readonly error: string };

export type UseProductSimulatorSessionResult = {
  readonly state: ProductSimulatorSessionState;
  readonly wipe: () => Promise<void>;
  readonly reboot: () => void;
};

type BootOutcome =
  | { readonly ok: true; readonly session: ProductSimulatorSession }
  | { readonly ok: false; readonly error: string }
  | null;

async function bootSession(args: {
  readonly boot: (
    opts?: BootProductSimulatorOptions
  ) => Promise<ProductSimulatorSession>;
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
export function useProductSimulatorSession(
  bootProductSimulator: (
    opts?: BootProductSimulatorOptions
  ) => Promise<ProductSimulatorSession>,
  active: Accessor<boolean>
): UseProductSimulatorSessionResult {
  const [state, setState] = createSignal<ProductSimulatorSessionState>({
    status: 'idle',
  });
  const [generation, setGeneration] = createSignal(0);
  let current: ProductSimulatorSession | null = null;
  let disposeGate = Promise.resolve();
  let skipSnapshotLoad = false;
  createEffect(() => {
    generation();
    if (!active()) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let live: ProductSimulatorSession | null = null;
    setState({ status: 'booting' });
    const skip = skipSnapshotLoad;
    skipSnapshotLoad = false;
    const isCancelled = () => cancelled;
    const run = disposeGate.then(async () => {
      const outcome = await bootSession({
        boot: bootProductSimulator,
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
