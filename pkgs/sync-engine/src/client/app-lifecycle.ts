/** Runtime-injected foreground / connectivity signals for event-driven sync. */
export type AppLifecycleEvent =
  | 'foreground'
  | 'background'
  | 'online'
  | 'offline';

export type AppLifecycle = {
  readonly isForeground: () => boolean;
  readonly isOnline: () => boolean;
  readonly subscribe: (cb: (event: AppLifecycleEvent) => void) => () => void;
};

/** Default lifecycle when the host omits one — always foreground + online. */
export function alwaysOnLifecycle(): AppLifecycle {
  return {
    isForeground: () => true,
    isOnline: () => true,
    subscribe: () => () => undefined,
  };
}

/** Test helper — drive foreground / online transitions manually. */
export function createControllableLifecycle(initial?: {
  readonly foreground?: boolean;
  readonly online?: boolean;
}): {
  readonly lifecycle: AppLifecycle;
  readonly setForeground: (value: boolean) => void;
  readonly setOnline: (value: boolean) => void;
} {
  let foreground = initial?.foreground ?? true;
  let online = initial?.online ?? true;
  const listeners = new Set<(event: AppLifecycleEvent) => void>();
  return {
    lifecycle: {
      isForeground: () => foreground,
      isOnline: () => online,
      subscribe: (cb) => {
        listeners.add(cb);
        return () => {
          listeners.delete(cb);
        };
      },
    },
    setForeground: (value) => {
      if (value === foreground) return;
      foreground = value;
      const event: AppLifecycleEvent = value ? 'foreground' : 'background';
      for (const cb of [...listeners]) cb(event);
    },
    setOnline: (value) => {
      if (value === online) return;
      online = value;
      const event: AppLifecycleEvent = value ? 'online' : 'offline';
      for (const cb of [...listeners]) cb(event);
    },
  };
}
