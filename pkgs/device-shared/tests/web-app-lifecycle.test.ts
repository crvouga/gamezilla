import { describe, expect, test } from 'bun:test';
import { createWebAppLifecycle, onAppResume } from '@pkgs/device-shared/web-app-lifecycle';
import type { AppLifecycleEvent } from '@pkgs/sync-engine-shared/app-lifecycle';

type Handler = () => void;

function createFakeTarget(initial: {
  visibility: 'visible' | 'hidden';
  onLine: boolean;
}) {
  const handlers = new Map<string, Set<Handler>>();
  const on = (type: string, listener: Handler): void => {
    let set = handlers.get(type);
    if (set === undefined) {
      set = new Set();
      handlers.set(type, set);
    }
    set.add(listener);
  };
  const state = { visibility: initial.visibility, onLine: initial.onLine };
  return {
    state,
    document: {
      get visibilityState() {
        return state.visibility;
      },
      addEventListener: on,
    },
    window: {
      navigator: {
        get onLine() {
          return state.onLine;
        },
      },
      addEventListener: on,
    },
    fire(type: string) {
      for (const h of [...(handlers.get(type) ?? [])]) h();
    },
  };
}

describe('createWebAppLifecycle', () => {
  test('initial state mirrors document visibility + navigator.onLine', () => {
    const t = createFakeTarget({ visibility: 'hidden', onLine: false });
    const lifecycle = createWebAppLifecycle(t);
    expect(lifecycle.isForeground()).toBe(false);
    expect(lifecycle.isOnline()).toBe(false);
  });

  test('emits foreground/background and online/offline transitions once each', () => {
    const t = createFakeTarget({ visibility: 'visible', onLine: true });
    const lifecycle = createWebAppLifecycle(t);
    const events: AppLifecycleEvent[] = [];
    lifecycle.subscribe((e) => events.push(e));

    t.state.visibility = 'hidden';
    t.fire('visibilitychange');
    t.fire('visibilitychange'); // duplicate — no change
    t.state.visibility = 'visible';
    t.fire('visibilitychange');
    t.state.onLine = false;
    t.fire('offline');
    t.fire('offline');
    t.state.onLine = true;
    t.fire('online');

    expect(events).toEqual(['background', 'foreground', 'offline', 'online']);
    expect(lifecycle.isForeground()).toBe(true);
    expect(lifecycle.isOnline()).toBe(true);
  });

  test('onAppResume fires only on foreground and can be disposed', () => {
    const t = createFakeTarget({ visibility: 'visible', onLine: true });
    const lifecycle = createWebAppLifecycle(t);
    let resumed = 0;
    const dispose = onAppResume(lifecycle, () => {
      resumed += 1;
    });
    t.state.visibility = 'hidden';
    t.fire('visibilitychange');
    expect(resumed).toBe(0);
    t.state.visibility = 'visible';
    t.fire('visibilitychange');
    expect(resumed).toBe(1);
    dispose();
    t.state.visibility = 'hidden';
    t.fire('visibilitychange');
    t.state.visibility = 'visible';
    t.fire('visibilitychange');
    expect(resumed).toBe(1);
  });
});
