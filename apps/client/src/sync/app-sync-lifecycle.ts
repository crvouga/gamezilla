import { AppState, type AppStateStatus, Platform } from 'react-native';

import type {
  AppLifecycle,
  AppLifecycleEvent,
} from '@pkgs/sync-engine/client/app-lifecycle';

type Listener = (event: AppLifecycleEvent) => void;

/**
 * RN AppState + web visibilitychange + online/offline → sync lifecycle port.
 * Created once per engine; host listeners stay for process lifetime.
 */
export function createAppSyncLifecycle(): AppLifecycle {
  const listeners = new Set<Listener>();
  let foregrounded = AppState.currentState === 'active';
  let online = true;

  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    online = navigator.onLine !== false;
  }

  function emit(event: AppLifecycleEvent): void {
    for (const listener of [...listeners]) listener(event);
  }

  function onAppState(next: AppStateStatus): void {
    const nextFg = next === 'active';
    if (nextFg === foregrounded) return;
    foregrounded = nextFg;
    emit(nextFg ? 'foreground' : 'background');
  }

  AppState.addEventListener('change', onAppState);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const onVisibility = (): void => {
      const nextFg = document.visibilityState !== 'hidden';
      if (nextFg === foregrounded) return;
      foregrounded = nextFg;
      emit(nextFg ? 'foreground' : 'background');
    };
    const onOnline = (): void => {
      online = true;
      emit('online');
    };
    const onOffline = (): void => {
      online = false;
      emit('offline');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

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
