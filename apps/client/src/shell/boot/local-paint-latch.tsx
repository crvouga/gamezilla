/** @jsxImportSource solid-js */
/**
 * Boot paint latch: the product navigator paints only once fonts (system stack
 * / `document.fonts.ready`) and the identity-scoped local SQLite engine are
 * ready. Never waits on network first-sync. Prefer no webfonts on the critical
 * path (see docs/low-end-android-perf.md).
 *
 * The RN latch also waited on the Skia chess canvas warm-up; the chess board
 * port owns that preload when its screen lands.
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
  /** True when fonts and the local engine are ready. */
  readonly bootReady: Accessor<boolean>;
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
    bootReady: () => fontsReady() && engineReady(),
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
