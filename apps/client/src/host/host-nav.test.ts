import { describe, expect, test } from 'bun:test';
import {
  applyHostNavPatch,
  buildHostSearch,
  coerceView,
  DEFAULT_HOST_NAV,
  parseHostNav,
  setClientView,
} from '@apps/client/host/host-nav';

describe('parseHostNav', () => {
  test('defaults when search empty', () => {
    expect(parseHostNav('')).toEqual(DEFAULT_HOST_NAV);
    expect(parseHostNav('?')).toEqual(DEFAULT_HOST_NAV);
  });

  test('parses console playground chrome', () => {
    expect(
      parseHostNav('?host=console&section=playground&kind=api&view=commands')
    ).toEqual({
      host: 'console',
      section: 'playground',
      kind: 'api',
      view: 'commands',
      clientViews: {},
    });
  });

  test('parses per-client views from cv', () => {
    expect(
      parseHostNav('?host=console&kind=client&cv=alice:db,bob:logs')
    ).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'client',
      view: 'ui',
      clientViews: { alice: 'db', bob: 'logs' },
    });
  });

  test('ignores unknown enum values', () => {
    expect(parseHostNav('?host=nope&section=x&kind=y&view=z')).toEqual({
      host: 'main',
      section: 'reports',
      kind: 'client',
      view: 'ui',
      clientViews: {},
    });
  });

  test('coerces illegal view for kind', () => {
    expect(parseHostNav('?host=console&kind=api&view=ui')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'api',
      view: 'db',
      clientViews: {},
    });
  });

  test('coerces illegal client views in cv', () => {
    expect(parseHostNav('?host=console&cv=alice:commands,bob:ui')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'client',
      view: 'ui',
      clientViews: {},
    });
  });

  test('preserves unrelated query keys on round-trip', () => {
    const state = parseHostNav(
      '?host=console&section=playground&kind=pubsub&view=topics&resetDb=1'
    );
    expect(buildHostSearch(state, '?resetDb=1&junk=2')).toBe(
      '?resetDb=1&junk=2&host=console&section=playground&kind=events&view=topics'
    );
  });

  test('round-trips cv', () => {
    const state = parseHostNav(
      '?host=console&kind=client&cv=bob:logs,alice:db'
    );
    expect(buildHostSearch(state)).toBe(
      '?host=console&cv=alice%3Adb%2Cbob%3Alogs'
    );
  });
});

describe('buildHostSearch', () => {
  test('omits defaults for main', () => {
    expect(buildHostSearch(DEFAULT_HOST_NAV)).toBe('');
  });

  test('omits default section/kind/view under console', () => {
    expect(
      buildHostSearch({
        host: 'console',
        section: 'reports',
        kind: 'client',
        view: 'ui',
        clientViews: {},
      })
    ).toBe('?host=console');
  });

  test('drops chrome keys when returning to main', () => {
    expect(
      buildHostSearch(
        DEFAULT_HOST_NAV,
        '?host=console&section=playground&cv=alice:db&x=1'
      )
    ).toBe('?x=1');
  });
});

describe('coerceView / applyHostNavPatch / setClientView', () => {
  test('coerceView picks kind default when illegal', () => {
    expect(coerceView('client', 'commands')).toBe('ui');
    expect(coerceView('api', 'topics')).toBe('db');
    expect(coerceView('events', 'ui')).toBe('logs');
    expect(coerceView('room', 'commands')).toBe('db');
  });

  test('legacy kind=server/pubsub map to api/events', () => {
    expect(parseHostNav('?host=console&kind=server&view=commands')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'api',
      view: 'commands',
      clientViews: {},
    });
    expect(parseHostNav('?host=console&kind=pubsub&view=topics')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'events',
      view: 'topics',
      clientViews: {},
    });
    expect(
      buildHostSearch({
        host: 'console',
        section: 'playground',
        kind: 'api',
        view: 'commands',
        clientViews: {},
      })
    ).toBe('?host=console&section=playground&kind=api&view=commands');
  });

  test('legacy kind=actor maps to room', () => {
    expect(parseHostNav('?host=console&kind=actor')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'room',
      view: 'db',
      clientViews: {},
    });
  });

  test('kind change coerces view and keeps clientViews', () => {
    const next = applyHostNavPatch(
      {
        host: 'console',
        section: 'playground',
        kind: 'client',
        view: 'ui',
        clientViews: { alice: 'db' },
      },
      { kind: 'api' }
    );
    expect(next).toEqual({
      host: 'console',
      section: 'playground',
      kind: 'api',
      view: 'db',
      clientViews: { alice: 'db' },
    });
  });

  test('explicit view wins when legal for new kind', () => {
    const next = applyHostNavPatch(
      {
        host: 'console',
        section: 'playground',
        kind: 'client',
        view: 'ui',
        clientViews: {},
      },
      { kind: 'api', view: 'logs' }
    );
    expect(next.view).toBe('logs');
  });

  test('setClientView updates one client without touching others', () => {
    const base = {
      host: 'console' as const,
      section: 'playground' as const,
      kind: 'client' as const,
      view: 'ui',
      clientViews: { alice: 'db' },
    };
    expect(setClientView(base, 'bob', 'logs').clientViews).toEqual({
      alice: 'db',
      bob: 'logs',
    });
    expect(setClientView(base, 'alice', 'ui').clientViews).toEqual({});
  });

  test('clientView patch merges via applyHostNavPatch', () => {
    const next = applyHostNavPatch(
      {
        host: 'console',
        section: 'playground',
        kind: 'client',
        view: 'ui',
        clientViews: { alice: 'db' },
      },
      { clientView: { id: 'bob', view: 'logs' } }
    );
    expect(next.clientViews).toEqual({ alice: 'db', bob: 'logs' });
  });
});
