import { describe, expect, test } from 'bun:test';
import {
  harnessEmulatorPanelId,
  harnessPanelKind,
  harnessPanels,
  nextHarnessClient,
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

  test('a system with no client shows its first panel, and none shows nothing', () => {
    expect(resolveHarnessView(null, ids({ ...WORLD, clients: [] }))).toBe('lb');
    expect(resolveHarnessView('client:alice', [])).toBeNull();
  });
});

describe('nextHarnessClient', () => {
  test('goes to the client after the one on show, and around again', () => {
    expect(nextHarnessClient('client:alice', ids())).toBe('client:bob');
    expect(nextHarnessClient('client:bob', ids())).toBe('client:alice');
  });

  test('from a panel that is not a client it is the first client', () => {
    const withEmulator = [...ids(), harnessEmulatorPanelId('google')];
    expect(nextHarnessClient('emulator:google', withEmulator)).toBe(
      'client:alice'
    );
    expect(resolveHarnessView('emulator:google', withEmulator)).toBe(
      'emulator:google'
    );
    expect(shownHarnessClient('emulator:google')).toBeNull();
    expect(nextHarnessClient('server:server-a', ids())).toBe('client:alice');
    expect(nextHarnessClient(null, ids())).toBe('client:alice');
  });

  test('a lone client stays on show, and no client gives none', () => {
    const alone = ids({ ...WORLD, clients: ['alice'] });
    expect(nextHarnessClient('client:alice', alone)).toBe('client:alice');
    expect(nextHarnessClient('lb', ids({ ...WORLD, clients: [] }))).toBeNull();
  });
});

describe('shownHarnessClient', () => {
  test("names the client whose app is on show, when a client's is", () => {
    expect(shownHarnessClient('client:bob')).toBe('bob');
    expect(shownHarnessClient('server:server-a')).toBeNull();
    expect(shownHarnessClient(null)).toBeNull();
  });
});
