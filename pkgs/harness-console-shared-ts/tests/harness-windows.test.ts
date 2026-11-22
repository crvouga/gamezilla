import { describe, expect, test } from 'bun:test';
import {
  HARNESS_APP_VIEW,
  harnessPanelKind,
  harnessPanels,
  resolveHarnessView,
  shownHarnessClient,
} from '@pkgs/harness-console-shared-ts/harness-windows';

const WORLD = { clients: ['alice', 'bob'], servers: ['server-a'], rooms: [] };
const ids = (topology = WORLD) => harnessPanels(topology).map(({ id }) => id);

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

describe('resolveHarnessView', () => {
  test('a wanted panel that exists is the one on show', () => {
    expect(resolveHarnessView('client:bob', ids())).toBe('client:bob');
    expect(resolveHarnessView('server:server-a', ids())).toBe(
      'server:server-a'
    );
  });

  test('no choice, or one that is gone, falls back to the first client', () => {
    expect(resolveHarnessView(null, ids())).toBe('client:alice');
    expect(resolveHarnessView('client:zed', ids())).toBe('client:alice');
    expect(resolveHarnessView('room:closed', ids())).toBe('client:alice');
  });

  test('a world with no client shows the harness app; with no harness app, its first panel; with nothing, nothing', () => {
    const empty = ids({ ...WORLD, clients: [] });
    expect(resolveHarnessView(null, [...empty, HARNESS_APP_VIEW])).toBe(
      HARNESS_APP_VIEW
    );
    expect(
      resolveHarnessView('client:alice', [...empty, HARNESS_APP_VIEW])
    ).toBe(HARNESS_APP_VIEW);
    expect(resolveHarnessView(null, empty)).toBe('lb');
    expect(resolveHarnessView('client:alice', [])).toBeNull();
  });
});

describe('shownHarnessClient', () => {
  test("names the client whose app is on show, when a client's is", () => {
    expect(shownHarnessClient('client:bob')).toBe('bob');
    expect(shownHarnessClient('server:server-a')).toBeNull();
    expect(shownHarnessClient(null)).toBeNull();
  });
});
