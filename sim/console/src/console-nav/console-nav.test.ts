import { describe, expect, test } from 'bun:test';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  coerceView,
  DEFAULT_CONSOLE_NAV,
  parseConsoleNav,
} from '@sim/console/console-nav/console-nav';

describe('parseConsoleNav', () => {
  test('defaults when search empty', () => {
    expect(parseConsoleNav('')).toEqual(DEFAULT_CONSOLE_NAV);
    expect(parseConsoleNav('?')).toEqual(DEFAULT_CONSOLE_NAV);
  });

  test('parses playground chrome', () => {
    expect(
      parseConsoleNav('?section=playground&kind=server&view=commands')
    ).toEqual({
      section: 'playground',
      kind: 'server',
      instance: '',
      view: 'commands',
    });
  });

  test('legacy cv becomes instance and view', () => {
    expect(parseConsoleNav('?kind=client&cv=alice:db,bob:logs')).toEqual({
      section: 'reports',
      kind: 'client',
      instance: 'alice',
      view: 'db',
    });
  });

  test('instance query wins over legacy cv', () => {
    expect(parseConsoleNav('?kind=client&instance=bob&cv=alice:db')).toEqual({
      section: 'reports',
      kind: 'client',
      instance: 'bob',
      view: 'ui',
    });
  });

  test('aliases html/sqlite/logs views', () => {
    expect(parseConsoleNav('?kind=client&view=html').view).toBe('ui');
    expect(parseConsoleNav('?kind=server&view=sqlite').view).toBe('db');
    expect(parseConsoleNav('?kind=events&view=logs').view).toBe('events');
  });

  test('ignores unknown enum values', () => {
    expect(parseConsoleNav('?section=x&kind=y&view=z')).toEqual({
      section: 'reports',
      kind: 'client',
      instance: '',
      view: 'ui',
    });
  });

  test('coerces illegal view for kind', () => {
    expect(parseConsoleNav('?kind=server&view=ui')).toEqual({
      section: 'reports',
      kind: 'server',
      instance: '',
      view: 'db',
    });
  });

  test('preserves unrelated query keys on round-trip', () => {
    const state = parseConsoleNav(
      '?section=playground&kind=pubsub&view=topics&resetDb=1'
    );
    expect(buildConsoleSearch(state, '?resetDb=1&junk=2')).toBe(
      '?resetDb=1&junk=2&section=playground&kind=events&view=topics'
    );
  });

  test('round-trips instance', () => {
    const state = parseConsoleNav('?kind=client&instance=bob&view=events');
    expect(buildConsoleSearch(state)).toBe('?instance=bob&view=events');
  });

  test('ignores legacy host query', () => {
    expect(parseConsoleNav('?host=console&section=playground')).toEqual({
      section: 'playground',
      kind: 'client',
      instance: '',
      view: 'ui',
    });
  });
});

describe('buildConsoleSearch', () => {
  test('omits defaults', () => {
    expect(buildConsoleSearch(DEFAULT_CONSOLE_NAV)).toBe('');
  });

  test('omits default section/kind/view', () => {
    expect(
      buildConsoleSearch({
        section: 'reports',
        kind: 'client',
        instance: '',
        view: 'ui',
      })
    ).toBe('');
  });

  test('drops chrome keys when returning to defaults', () => {
    expect(
      buildConsoleSearch(
        DEFAULT_CONSOLE_NAV,
        '?host=console&section=playground&cv=alice:db&instance=bob&x=1'
      )
    ).toBe('?x=1');
  });
});

describe('coerceView / applyConsoleNavPatch', () => {
  test('coerceView picks kind default when illegal', () => {
    expect(coerceView('client', 'commands')).toBe('ui');
    expect(coerceView('server', 'topics')).toBe('db');
    expect(coerceView('events', 'ui')).toBe('events');
    expect(coerceView('room', 'commands')).toBe('db');
  });

  test('legacy kind=api/pubsub map to server/events', () => {
    expect(parseConsoleNav('?kind=api&view=commands')).toEqual({
      section: 'reports',
      kind: 'server',
      instance: '',
      view: 'commands',
    });
    expect(parseConsoleNav('?kind=pubsub&view=topics')).toEqual({
      section: 'reports',
      kind: 'events',
      instance: '',
      view: 'topics',
    });
    expect(
      buildConsoleSearch({
        section: 'playground',
        kind: 'server',
        instance: '',
        view: 'commands',
      })
    ).toBe('?section=playground&kind=server&view=commands');
  });

  test('legacy kind=actor maps to room', () => {
    expect(parseConsoleNav('?kind=actor')).toEqual({
      section: 'reports',
      kind: 'room',
      instance: '',
      view: 'db',
    });
  });

  test('kind change coerces view and clears singleton instance', () => {
    const next = applyConsoleNavPatch(
      {
        section: 'playground',
        kind: 'client',
        instance: 'alice',
        view: 'ui',
      },
      { kind: 'server' }
    );
    expect(next).toEqual({
      section: 'playground',
      kind: 'server',
      instance: '',
      view: 'db',
    });
  });

  test('explicit view wins when legal for new kind', () => {
    const next = applyConsoleNavPatch(
      {
        section: 'playground',
        kind: 'client',
        instance: '',
        view: 'ui',
      },
      { kind: 'server', view: 'logs' }
    );
    expect(next.view).toBe('events');
  });
});
