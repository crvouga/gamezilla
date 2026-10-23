/**
 * Browser {@link AppLifecycle} (sync-engine port): `visibilitychange` drives
 * foreground / background, `online` / `offline` drive connectivity. Takes an
 * injected document / window shape so it is testable without a DOM;
 * {@link ./wall-web-device.ts} binds the real globals.
 */

import type {
  AppLifecycle,
  AppLifecycleEvent,
} from '@pkgs/sync-engine-shared-ts/app-lifecycle';

export type WebDocumentLike = {
  readonly visibilityState: 'visible' | 'hidden' | string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
};

export type WebWindowLike = {
  readonly navigator?: { readonly onLine?: boolean } | undefined;
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
};

/**
 * Process-lifetime lifecycle port: host listeners are attached once and
 * never removed (the engine outlives every screen).
 */
export function createWebAppLifecycle(target: {
  readonly document: WebDocumentLike;
  readonly window: WebWindowLike;
}): AppLifecycle {
  const listeners = new Set<(event: AppLifecycleEvent) => void>();
  let foregrounded = target.document.visibilityState !== 'hidden';
  let online = target.window.navigator?.onLine !== false;

  const emit = (event: AppLifecycleEvent): void => {
    for (const listener of [...listeners]) listener(event);
  };

  target.document.addEventListener('visibilitychange', () => {
    const nextFg = target.document.visibilityState !== 'hidden';
    if (nextFg === foregrounded) return;
    foregrounded = nextFg;
    emit(nextFg ? 'foreground' : 'background');
  });
  target.window.addEventListener('online', () => {
    if (online) return;
    online = true;
    emit('online');
  });
  target.window.addEventListener('offline', () => {
    if (!online) return;
    online = false;
    emit('offline');
  });

  return {
    isForeground: () => foregrounded,
    isOnline: () => online,
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

/**
 * Convenience over {@link AppLifecycle}: run `onResume` every time the app
 * returns to the foreground (session refresh, socket liveness probes).
 */
export function onAppResume(
  lifecycle: AppLifecycle,
  onResume: () => void
): () => void {
  return lifecycle.subscribe((event) => {
    if (event === 'foreground') onResume();
  });
}
