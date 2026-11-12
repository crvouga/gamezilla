import { describe, expect, test } from 'bun:test';
import {
  admitHarnessPanels,
  arrangeHarnessLayout,
  harnessPanelKind,
  harnessPanels,
  resolveHarnessLayout,
  shownHarnessClients,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import {
  applyWindowLayoutCommand,
  windowGroups,
  windowOfPanel,
  windowPanels,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { serializeWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';

const WORLD = { clients: ['alice', 'bob'], servers: ['server-a'], rooms: [] };
const ids = (topology = WORLD) => harnessPanels(topology).map(({ id }) => id);
const tabs = (layout: ReturnType<typeof arrangeHarnessLayout>) =>
  windowGroups(layout).map((group) => group.tabs);

describe('harnessPanels', () => {
  test('lists one panel per node along the request path', () => {
    expect(
      harnessPanels({ ...WORLD, rooms: ['lobby'] }).map((panel) => [
        panel.id,
        panel.kind,
        panel.title,
      ])
    ).toEqual([
      ['client:alice', 'client', 'alice'],
      ['client:bob', 'client', 'bob'],
      ['lb', 'lb', 'balancer'],
      ['server:server-a', 'server', 'server-a'],
      ['events', 'events', 'pubsub'],
      ['room:lobby', 'room', 'lobby'],
    ]);
  });

  test('a panel id names its kind', () => {
    expect(ids().map(harnessPanelKind)).toEqual([
      'client',
      'client',
      'lb',
      'server',
      'events',
    ]);
  });
});

describe('arrangeHarnessLayout', () => {
  test('beside gives each client a window and tabs the rest', () => {
    expect(tabs(arrangeHarnessLayout(ids(), 'beside'))).toEqual([
      ['client:alice'],
      ['client:bob'],
      ['lb', 'server:server-a', 'events'],
    ]);
  });

  test('tabs puts the clients in one window', () => {
    expect(tabs(arrangeHarnessLayout(ids(), 'tabs'))).toEqual([
      ['client:alice', 'client:bob'],
      ['lb', 'server:server-a', 'events'],
    ]);
  });

  test('rearranging keeps the focused panel on show', () => {
    const beside = applyWindowLayoutCommand(
      arrangeHarnessLayout(ids(), 'beside'),
      { type: 'select', panel: 'client:bob' }
    );
    const tabbed = arrangeHarnessLayout(ids(), 'tabs', beside);
    expect(shownHarnessClients(tabbed)).toEqual(['bob']);
    expect(windowOfPanel(tabbed, 'client:bob')?.id ?? null).toBe(
      tabbed.focused
    );
  });
});

describe('resolveHarnessLayout', () => {
  test('missing or unreadable text gives the starting arrangement', () => {
    const start = arrangeHarnessLayout(ids(), 'beside');
    expect(resolveHarnessLayout(null, ids())).toEqual(start);
    expect(resolveHarnessLayout('not a layout', ids())).toEqual(start);
  });

  test('drops panels whose node is gone and falls back to one that exists', () => {
    const forBob = serializeWindowLayout(
      applyWindowLayoutCommand(arrangeHarnessLayout(ids(), 'tabs'), {
        type: 'select',
        panel: 'client:bob',
      })
    );
    const alone = ids({ ...WORLD, clients: ['alice'] });
    expect(shownHarnessClients(resolveHarnessLayout(forBob, alone))).toEqual([
      'alice',
    ]);
  });

  test('keeps a layout the team emptied on purpose', () => {
    expect(resolveHarnessLayout('{"r":null}', ids()).root).toBeNull();
  });

  test('a layout of nodes that are all gone starts over', () => {
    expect(
      windowPanels(resolveHarnessLayout('{"r":{"t":["client:zed"]}}', ids()))
    ).toEqual(ids());
  });
});

describe('admitHarnessPanels', () => {
  test('a new client gets a window beside the last client', () => {
    const layout = admitHarnessPanels(arrangeHarnessLayout(ids(), 'beside'), [
      'client:carol',
    ]);
    expect(tabs(layout)).toEqual([
      ['client:alice'],
      ['client:bob'],
      ['client:carol'],
      ['lb', 'server:server-a', 'events'],
    ]);
  });

  test('a new client joins the window that tabs clients', () => {
    const layout = admitHarnessPanels(arrangeHarnessLayout(ids(), 'tabs'), [
      'client:carol',
    ]);
    expect(tabs(layout)[0]).toEqual([
      'client:alice',
      'client:bob',
      'client:carol',
    ]);
    expect(shownHarnessClients(layout)).toEqual(['alice']);
  });

  test('a new room joins the rest of the system without taking focus', () => {
    const start = arrangeHarnessLayout(ids(), 'beside');
    const layout = admitHarnessPanels(start, ['room:lobby', 'lb']);
    expect(tabs(layout).at(-1)).toEqual([
      'lb',
      'server:server-a',
      'events',
      'room:lobby',
    ]);
    expect(windowGroups(layout).at(-1)?.active).toBe('lb');
    expect(layout.focused).toBe(start.focused);
  });

  test('opens a window when nothing is open', () => {
    const layout = admitHarnessPanels(resolveHarnessLayout('{"r":null}', []), [
      'client:alice',
    ]);
    expect(tabs(layout)).toEqual([['client:alice']]);
  });
});

describe('shownHarnessClients', () => {
  test('a maximized window is the only one on show', () => {
    const beside = arrangeHarnessLayout(ids(), 'beside');
    const bob = windowOfPanel(beside, 'client:bob');
    expect(shownHarnessClients(beside)).toEqual(['alice', 'bob']);
    expect(
      shownHarnessClients(
        applyWindowLayoutCommand(beside, {
          type: 'maximize',
          window: bob?.id ?? '',
        })
      )
    ).toEqual(['bob']);
  });
});
