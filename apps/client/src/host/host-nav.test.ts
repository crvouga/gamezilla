import { describe, expect, test } from 'bun:test';
import {
  applyHostNavPatch,
  buildHostSearch,
  coerceView,
  DEFAULT_HOST_NAV,
  parseHostNav,
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
      instance: '',
      view: 'commands',
    });
  });

  test('legacy cv becomes instance and view', () => {
    expect(
      parseHostNav('?host=console&kind=client&cv=alice:db,bob:logs')
    ).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'client',
      instance: 'alice',
      view: 'db',
    });
  });

  test('instance query wins over legacy cv', () => {
    expect(
      parseHostNav('?host=console&kind=client&instance=bob&cv=alice:db')
    ).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'client',
      instance: 'bob',
      view: 'ui',
    });
  });

  test('aliases html/sqlite/logs views', () => {
    expect(parseHostNav('?host=console&kind=client&view=html').view).toBe('ui');
    expect(parseHostNav('?host=console&kind=api&view=sqlite').view).toBe('db');
    expect(parseHostNav('?host=console&kind=events&view=logs').view).toBe(
      'events'
    );
  });

  test('ignores unknown enum values', () => {
    expect(parseHostNav('?host=nope&section=x&kind=y&view=z')).toEqual({
      host: 'main',
      section: 'reports',
      kind: 'client',
      instance: '',
      view: 'ui',
    });
  });

  test('coerces illegal view for kind', () => {
    expect(parseHostNav('?host=console&kind=api&view=ui')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'api',
      instance: '',
      view: 'db',
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

  test('round-trips instance', () => {
    const state = parseHostNav(
      '?host=console&kind=client&instance=bob&view=events'
    );
    expect(buildHostSearch(state)).toBe(
      '?host=console&instance=bob&view=events'
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
        instance: '',
        view: 'ui',
      })
    ).toBe('?host=console');
  });

  test('drops chrome keys when returning to main', () => {
    expect(
      buildHostSearch(
        DEFAULT_HOST_NAV,
        '?host=console&section=playground&cv=alice:db&instance=bob&x=1'
      )
    ).toBe('?x=1');
  });
});

describe('coerceView / applyHostNavPatch', () => {
  test('coerceView picks kind default when illegal', () => {
    expect(coerceView('client', 'commands')).toBe('ui');
    expect(coerceView('api', 'topics')).toBe('db');
    expect(coerceView('events', 'ui')).toBe('events');
    expect(coerceView('room', 'commands')).toBe('db');
  });

  test('legacy kind=server/pubsub map to api/events', () => {
    expect(parseHostNav('?host=console&kind=server&view=commands')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'api',
      instance: '',
      view: 'commands',
    });
    expect(parseHostNav('?host=console&kind=pubsub&view=topics')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'events',
      instance: '',
      view: 'topics',
    });
    expect(
      buildHostSearch({
        host: 'console',
        section: 'playground',
        kind: 'api',
        instance: '',
        view: 'commands',
      })
    ).toBe('?host=console&section=playground&kind=api&view=commands');
  });

  test('legacy kind=actor maps to room', () => {
    expect(parseHostNav('?host=console&kind=actor')).toEqual({
      host: 'console',
      section: 'reports',
      kind: 'room',
      instance: '',
      view: 'db',
    });
  });

  test('kind change coerces view and clears singleton instance', () => {
    const next = applyHostNavPatch(
      {
        host: 'console',
        section: 'playground',
        kind: 'client',
        instance: 'alice',
        view: 'ui',
      },
      { kind: 'api' }
    );
    expect(next).toEqual({
      host: 'console',
      section: 'playground',
      kind: 'api',
      instance: '',
      view: 'db',
    });
  });

  test('explicit view wins when legal for new kind', () => {
    const next = applyHostNavPatch(
      {
        host: 'console',
        section: 'playground',
        kind: 'client',
        instance: '',
        view: 'ui',
      },
      { kind: 'api', view: 'logs' }
    );
    expect(next.view).toBe('events');
  });
});
