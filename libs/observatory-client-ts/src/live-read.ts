import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';

/** A read these screens keep current, with the states they draw themselves. */
export type LiveRead<T> = {
  /** The last value read, kept while a later read runs or fails. */
  readonly shown: Accessor<T | undefined>;
  /** A read is under way. */
  readonly loading: Accessor<boolean>;
  /** The last read failed. */
  readonly failed: Accessor<boolean>;
  /** Reads again; settles once the newest read ends, whether or not it failed. */
  readonly reread: () => Promise<void>;
};

/**
 * Reads `read(source())` whenever the source changes and whenever `reread`
 * asks. These screens draw their own loading and error states, so the read
 * never reaches the route's loading boundary (which would swap the whole
 * screen for a spinner on every live update). Only the newest read lands; an
 * `undefined` source reads nothing.
 */
export function createLiveRead<S, T>(
  source: Accessor<S | undefined>,
  read: (source: S) => Promise<T>
): LiveRead<T> {
  const [turn, setTurn] = createSignal(0);
  const asked = createMemo(() => ({ source: source(), turn: turn() }));
  const [answered, setAnswered] = createSignal<object>();
  const [shown, setShown] = createSignal<{ readonly value: T }>();
  const [failed, setFailed] = createSignal(false);
  let waiting: (() => void)[] = [];
  const release = () => {
    const ended = waiting;
    waiting = [];
    for (const resolve of ended) resolve();
  };
  createEffect(asked, (request) => {
    const from = request.source;
    if (from === undefined) {
      release();
      return;
    }
    let newest = true;
    const land = (value: { readonly value: T } | null) => {
      if (!newest) return;
      if (value !== null) setShown(value);
      setFailed(value === null);
      setAnswered(request);
      release();
    };
    void (async () => read(from))().then(
      (value) => land({ value }),
      () => land(null)
    );
    return () => {
      newest = false;
    };
  });
  onCleanup(release);
  return {
    shown: () => shown()?.value,
    loading: () => asked().source !== undefined && answered() !== asked(),
    failed,
    reread: () => {
      const ended = new Promise<void>((resolve) => waiting.push(resolve));
      setTurn((count) => count + 1);
      return ended;
    },
  };
}
