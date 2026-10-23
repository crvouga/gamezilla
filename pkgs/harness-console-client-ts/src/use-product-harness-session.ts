import type {
  BootProductHarnessOptions,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

export type ProductHarnessSessionState =
  | { readonly status: 'idle' }
  | { readonly status: 'booting' }
  | { readonly status: 'ready'; readonly session: ProductHarnessSession }
  | { readonly status: 'error'; readonly error: string };

export type UseProductHarnessSessionResult = {
  readonly state: ProductHarnessSessionState;
  readonly wipe: () => Promise<void>;
  readonly reboot: () => void;
};

type BootOutcome =
  | { readonly ok: true; readonly session: ProductHarnessSession }
  | { readonly ok: false; readonly error: string }
  | null;

async function bootSession(args: {
  readonly boot: (
    opts?: BootProductHarnessOptions
  ) => Promise<ProductHarnessSession>;
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
export function useProductHarnessSession(
  bootProductHarness: (
    opts?: BootProductHarnessOptions
  ) => Promise<ProductHarnessSession>,
  active: Accessor<boolean>
): UseProductHarnessSessionResult {
  const [state, setState] = createSignal<ProductHarnessSessionState>({
    status: 'idle',
  });
  const [generation, setGeneration] = createSignal(0);
  let current: ProductHarnessSession | null = null;
  let disposeGate = Promise.resolve();
  let skipSnapshotLoad = false;
  createEffect(() => {
    generation();
    if (!active()) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let live: ProductHarnessSession | null = null;
    setState({ status: 'booting' });
    const skip = skipSnapshotLoad;
    skipSnapshotLoad = false;
    const isCancelled = () => cancelled;
    const run = disposeGate.then(async () => {
      const outcome = await bootSession({
        boot: bootProductHarness,
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
