/** @jsxImportSource solid-js */
/**
 * Boot paint latch: the product navigator paints once fonts are ready
 * (system stack / `document.fonts.ready`). Local SQLite may still be opening
 * in the background — do **not** block first paint on WASM (low-end Android
 * bar; see docs/low-end-android-perf.md).
 *
 * `markEngineReady` remains for sync boot bookkeeping; it does not gate paint.
 */

import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';

export type LocalPaintLatchValue = {
  readonly markFontsReady: () => void;
  readonly markEngineReady: () => void;
  /** True when fonts are ready (first paint). Engine readiness is separate. */
  readonly bootReady: Accessor<boolean>;
  /** True when the local sync engine finished opening (or stuck). */
  readonly engineReady: Accessor<boolean>;
};

const LocalPaintLatchContext = createContext<LocalPaintLatchValue>();

type FontFaceSetLike = { readonly ready?: Promise<unknown> | undefined };

function documentFontsReady(): Promise<unknown> | null {
  const doc = (globalThis as { document?: { fonts?: FontFaceSetLike } })
    .document;
  const fonts = doc?.fonts;
  const ready = fonts?.ready;
  if (ready === undefined || typeof ready.then !== 'function') {
    return null;
  }
  return ready;
}

export function LocalPaintLatchProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [fontsReady, setFontsReady] = createSignal(false);
  const [engineReady, setEngineReady] = createSignal(false);

  onMount(() => {
    const ready = documentFontsReady();
    if (ready === null) {
      setFontsReady(true);
      return;
    }
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    // Font load failures still release the gate: fallback stacks render.
    void ready.then(
      () => {
        if (!cancelled) setFontsReady(true);
      },
      () => {
        if (!cancelled) setFontsReady(true);
      }
    );
  });

  const value: LocalPaintLatchValue = {
    markFontsReady: () => setFontsReady(true),
    markEngineReady: () => setEngineReady(true),
    bootReady: () => fontsReady(),
    engineReady: () => engineReady(),
  };

  return (
    <LocalPaintLatchContext.Provider value={value}>
      {props.children}
    </LocalPaintLatchContext.Provider>
  );
}

export function useLocalPaintLatch(): LocalPaintLatchValue {
  const value = useContext(LocalPaintLatchContext);
  if (value === undefined) {
    throw new Error(
      'useLocalPaintLatch: missing LocalPaintLatchProvider — wrap with AppProviders'
    );
  }
  return value;
}
