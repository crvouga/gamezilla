import { describe, expect, test } from 'bun:test';
import type { NetworkState } from '@pkgs/device-shared/network-state';
import {
  createInMemoryNetworkStatePort,
  networkStateNone,
  networkStateWifi,
} from '@pkgs/device-shared/network-state';
import {
  createWebNetworkStatePort,
  readWebNetworkState,
} from '@pkgs/device-shared/web-network-state';

type Handler = () => void;

function createFakeWindow() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    events: {
      addEventListener(type: string, listener: Handler) {
        let set = handlers.get(type);
        if (set === undefined) {
          set = new Set();
          handlers.set(type, set);
        }
        set.add(listener);
      },
      removeEventListener(type: string, listener: Handler) {
        handlers.get(type)?.delete(listener);
      },
    },
    fire(type: string) {
      for (const h of [...(handlers.get(type) ?? [])]) h();
    },
    count(type: string) {
      return handlers.get(type)?.size ?? 0;
    },
  };
}

describe('in-memory network state port', () => {
  test('subscribe replays current state then emits changes', async () => {
    const port = createInMemoryNetworkStatePort();
    const seen: NetworkState[] = [];
    const unsub = port.subscribe((s) => seen.push(s));
    expect(seen).toEqual([networkStateWifi()]);
    port.emit(networkStateNone());
    expect(seen).toHaveLength(2);
    expect(await port.getState()).toEqual(networkStateNone());
    unsub();
    port.emit(networkStateWifi());
    expect(seen).toHaveLength(2);
  });

  test('setState updates without notifying', async () => {
    const port = createInMemoryNetworkStatePort();
    const seen: NetworkState[] = [];
    port.subscribe((s) => seen.push(s));
    port.setState(networkStateNone());
    expect(seen).toHaveLength(1);
    expect(await port.getState()).toEqual(networkStateNone());
  });
});

describe('web network state', () => {
  test('readWebNetworkState maps onLine + connection.type', () => {
    expect(readWebNetworkState({ onLine: false })).toEqual({
      type: 'NONE',
      isConnected: false,
      isInternetReachable: false,
    });
    expect(readWebNetworkState({ onLine: true })).toEqual({
      type: 'UNKNOWN',
      isConnected: true,
      isInternetReachable: null,
    });
    expect(
      readWebNetworkState({ onLine: true, connection: { type: 'wifi' } }).type
    ).toBe('WIFI');
    expect(
      readWebNetworkState({ onLine: true, connection: { type: 'mixed' } }).type
    ).toBe('OTHER');
    // Missing `onLine` (non-browser) is treated as online.
    expect(readWebNetworkState({}).isConnected).toBe(true);
  });

  test('port attaches listeners once and detaches after last unsubscribe', () => {
    const win = createFakeWindow();
    const nav = { onLine: true };
    const port = createWebNetworkStatePort({
      navigator: nav,
      events: win.events,
    });
    const a: NetworkState[] = [];
    const b: NetworkState[] = [];
    const unsubA = port.subscribe((s) => a.push(s));
    const unsubB = port.subscribe((s) => b.push(s));
    expect(win.count('online')).toBe(1);
    expect(win.count('offline')).toBe(1);

    nav.onLine = false;
    win.fire('offline');
    expect(a.at(-1)?.isConnected).toBe(false);
    expect(b.at(-1)?.isConnected).toBe(false);

    unsubA();
    expect(win.count('online')).toBe(1);
    unsubB();
    expect(win.count('online')).toBe(0);
    expect(win.count('offline')).toBe(0);
  });
});
