export type MotionPreferencePort = {
  readonly reduced: () => boolean;
  readonly subscribe: (listener: (reduced: boolean) => void) => () => void;
};

export type MutableMotionPreferencePort = MotionPreferencePort & {
  readonly setReduced: (reduced: boolean) => void;
};

/** A per-device preference; it never changes another device's browser settings. */
export function createMotionPreference(
  reduced = false
): MutableMotionPreferencePort {
  let value = reduced;
  const listeners = new Set<(reduced: boolean) => void>();
  return {
    reduced: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setReduced: (next) => {
      value = next;
      for (const listener of listeners) listener(value);
    },
  };
}
