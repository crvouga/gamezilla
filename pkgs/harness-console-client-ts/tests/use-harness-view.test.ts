import { describe, expect, test } from 'bun:test';
import { createRoot, createSignal } from 'solid-js';
import type { HarnessConsoleNav } from '../src/debugger-chrome';
import {
  type HarnessViewSession,
  useHarnessView,
} from '../src/use-harness-view';

/** A session whose nodes the test changes, and a host that keeps `show`. */
function world(start: string | null = null) {
  const clients = new Map<string, unknown>([
    ['alice', {}],
    ['bob', {}],
  ]);
  const listeners = new Set<() => void>();
  let revision = 0;
  const session: HarnessViewSession = {
    get revision() {
      return revision;
    },
    snapshotRestoring: false,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clients,
    servers: new Map([['server-a', {}]]),
    rooms: new Map(),
  };
  const [show, setShow] = createSignal(start);
  const writes: (string | null)[] = [];
  const nav = (): HarnessConsoleNav => ({
    show: show(),
    panes: {},
    onShow: (panel) => {
      writes.push(panel);
      setShow(panel);
    },
    onPanePatch: () => undefined,
  });
  return {
    session: () => session,
    nav,
    writes,
    setShow,
    change: (edit: (clients: Map<string, unknown>) => void) => {
      edit(clients);
      revision += 1;
      for (const listener of listeners) listener();
    },
  };
}

function mounted<T>(run: () => T): T {
  return createRoot(() => run());
}

describe('useHarnessView', () => {
  test('shows the first client until the host names another panel', () => {
    const w = world();
    const view = mounted(() => useHarnessView(w.session, w.nav));
    expect(view.shown()?.id).toBe('client:alice');
    expect(view.panels().map((panel) => panel.id)).toEqual([
      'client:alice',
      'client:bob',
      'lb',
      'server:server-a',
      'events',
    ]);
    w.setShow('server:server-a');
    expect(view.shown()?.id).toBe('server:server-a');
  });

  test('next goes round the clients and comes back to them from behind', () => {
    const w = world();
    const view = mounted(() => useHarnessView(w.session, w.nav));
    view.next();
    expect(view.shown()?.id).toBe('client:bob');
    view.next();
    expect(view.shown()?.id).toBe('client:alice');
    view.show('lb');
    view.next();
    expect(view.shown()?.id).toBe('client:alice');
    expect(w.writes).toEqual([
      'client:bob',
      'client:alice',
      'lb',
      'client:alice',
    ]);
  });

  test('showing what is already on show writes nothing', () => {
    const w = world();
    const view = mounted(() => useHarnessView(w.session, w.nav));
    view.show('client:alice');
    expect(w.writes).toEqual([]);
  });

  test('a client that goes is no longer on show, and one that comes can be', () => {
    const w = world('client:bob');
    const view = mounted(() => useHarnessView(w.session, w.nav));
    expect(view.shown()?.id).toBe('client:bob');
    w.change((clients) => clients.delete('bob'));
    expect(view.shown()?.id).toBe('client:alice');
    w.change((clients) => clients.set('carol', {}));
    view.next();
    expect(view.shown()?.id).toBe('client:carol');
  });
});
