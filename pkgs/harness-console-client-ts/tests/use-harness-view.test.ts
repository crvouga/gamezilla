import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_HARNESS_SWITCHER,
  harnessSwitcherWith,
} from '@pkgs/harness-console-shared-ts/harness-windows';
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
  const [switcher, setSwitcher] = createSignal(DEFAULT_HARNESS_SWITCHER);
  const writes: (string | null)[] = [];
  const nav = (): HarnessConsoleNav => ({
    show: show(),
    panes: {},
    switcher: switcher(),
    onShow: (panel) => {
      writes.push(panel);
      setShow(panel);
    },
    onPanePatch: () => undefined,
    onSwitcher: (view, on) =>
      setSwitcher((choice) => harnessSwitcherWith(choice, view, on)),
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

  test('the switcher goes round the clients and the harness app, and back to it from behind', () => {
    const w = world();
    const view = mounted(() => useHarnessView(w.session, w.nav));
    view.switchTo({ to: 'next' });
    expect(view.shown()?.id).toBe('client:bob');
    view.switchTo({ to: 'next' });
    // The harness app is a view of its own, not a node's panel.
    expect(view.shownId()).toBe('harness');
    expect(view.shown()).toBeNull();
    view.switchTo({ to: 'next' });
    expect(view.shown()?.id).toBe('client:alice');
    view.show('lb');
    view.switchTo({ to: 'next' });
    expect(view.shownId()).toBe('harness');
    view.switchTo({ to: 'previous' });
    expect(view.shown()?.id).toBe('client:bob');
    view.switchTo({ to: 'app', at: 0 });
    view.switchTo({ to: 'app', at: 8 });
    view.switchTo({ to: 'harness' });
    expect(w.writes).toEqual([
      'client:bob',
      'harness',
      'client:alice',
      'lb',
      'harness',
      'client:bob',
      'client:alice',
      'harness',
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
    view.switchTo({ to: 'next' });
    expect(view.shown()?.id).toBe('client:carol');
  });

  test('with no client left, the harness app is on show and the switcher has nowhere to go', () => {
    const w = world('client:bob');
    const view = mounted(() => useHarnessView(w.session, w.nav));
    expect(view.next()).toBe('harness');
    w.change((clients) => clients.clear());
    expect(view.shownId()).toBe('harness');
    expect(view.apps()).toEqual(['harness']);
    expect(view.next()).toBeNull();
    // A view opened from the harness app still has the way back.
    view.show('lb');
    expect(view.next()).toBe('harness');
    w.change((clients) => clients.set('carol', {}));
    expect(view.apps()).toEqual(['client:carol', 'harness']);
  });

  test('the switcher goes through the views put in it, and past the ones taken out', () => {
    const w = world();
    const view = mounted(() =>
      useHarnessView(w.session, w.nav, () => ['emulator:google'])
    );
    view.setInSwitcher('client:bob', false);
    view.setInSwitcher('emulator:google', true);
    view.setInSwitcher('harness', false);
    expect(view.apps()).toEqual(['client:alice', 'emulator:google', 'harness']);
    view.switchTo({ to: 'next' });
    expect(view.shownId()).toBe('emulator:google');
    view.switchTo({ to: 'next' });
    expect(view.shownId()).toBe('harness');
    // Out of the switcher is not gone: it is still there to be shown.
    view.show('client:bob');
    expect(view.shown()?.id).toBe('client:bob');
    expect(view.next()).toBe('harness');
  });
});
