/**
 * `SpinnerProvider` -- keeps spinner rotation alive across remounts.
 *
 * `Spinner` defaults to a per-instance `Animated.loop`, so swapping between
 * sibling loading states (e.g. list → detail → list) visibly restarts the
 * animation back to 0°. Wrap a subtree in `SpinnerProvider` to hand out a
 * persistent `Animated.Value` per spinner variant; spinners may mount and
 * unmount freely without resetting the rotation.
 *
 * The provider is opt-in: `Spinner` falls back to its own loop when no
 * provider is mounted, so isolated usages (examples, tests) keep working
 * unchanged.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Animated, Easing } from 'react-native';

import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';

/** One full rotation cycle. Shared with the local-fallback loop in `Spinner`. */
export const SPIN_DURATION_MS = 900;

type RotationKey = string;

type RotationEntry = {
  rotation: Animated.Value;
  loop: Animated.CompositeAnimation | null;
  consumers: number;
};

type SpinnerContextValue = {
  ensureEntry: (key: RotationKey) => RotationEntry;
  subscribe: (key: RotationKey) => () => void;
};

const SpinnerContext = createContext<SpinnerContextValue | null>(null);

function createRotationEntry(): RotationEntry {
  return { rotation: new Animated.Value(0), loop: null, consumers: 0 };
}

/**
 * (Re)start the loop from 0. A stopped `Animated.loop` composite cannot be
 * reliably restarted, so we build a fresh one on every cold start — otherwise
 * a spinner that mounts after all siblings have unmounted (e.g. a modal that
 * opens later in the session) renders frozen.
 */
function startEntry(entry: RotationEntry): void {
  entry.loop?.stop();
  entry.rotation.setValue(0);
  entry.loop = Animated.loop(
    Animated.timing(entry.rotation, {
      toValue: 1,
      duration: SPIN_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: USE_NATIVE_DRIVER,
    })
  );
  entry.loop.start();
}

function stopEntry(entry: RotationEntry): void {
  entry.loop?.stop();
  entry.loop = null;
}

function ensureEntry(
  map: Map<RotationKey, RotationEntry>,
  key: RotationKey
): RotationEntry {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const entry = createRotationEntry();
  map.set(key, entry);
  return entry;
}

function useStableRotationMap(): Map<RotationKey, RotationEntry> {
  const ref = useRef<Map<RotationKey, RotationEntry> | null>(null);
  if (ref.current === null) ref.current = new Map();
  return ref.current;
}

export function SpinnerProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const map = useStableRotationMap();

  const value = useMemo<SpinnerContextValue>(
    () => ({
      ensureEntry: (key) => ensureEntry(map, key),
      subscribe: (key) => {
        const entry = ensureEntry(map, key);
        entry.consumers += 1;
        if (entry.consumers === 1) startEntry(entry);
        return () => {
          entry.consumers -= 1;
          if (entry.consumers === 0) stopEntry(entry);
        };
      },
    }),
    [map]
  );

  useEffect(() => {
    return () => {
      for (const entry of map.values()) stopEntry(entry);
      map.clear();
    };
  }, [map]);

  return (
    <SpinnerContext.Provider value={value}>{children}</SpinnerContext.Provider>
  );
}

/**
 * Returns the shared rotation `Animated.Value` for `key` when a
 * `SpinnerProvider` is mounted above, or `null` otherwise.
 *
 * The rotation loop starts in `useEffect` (after mount) so native-driver
 * transforms attach reliably on iOS; starting loops during render was
 * leaving playground spinners frozen under `SpinnerProvider`.
 */
export function useSharedSpinnerRotation(
  key: RotationKey
): Animated.Value | null {
  const ctx = useContext(SpinnerContext);

  useEffect(() => {
    if (ctx === null) return undefined;
    return ctx.subscribe(key);
  }, [ctx, key]);

  if (ctx === null) return null;
  return ctx.ensureEntry(key).rotation;
}
