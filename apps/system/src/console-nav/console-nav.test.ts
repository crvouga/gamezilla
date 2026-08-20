import { describe, expect, test } from 'bun:test';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  coerceView,
  DEFAULT_CONSOLE_NAV,
  parseConsoleNav,
} from '@apps/system/console-nav/console-nav';

describe('parseConsoleNav', () => {
  test('defaults when search empty', () => {
    expect(parseConsoleNav('')).toEqual(DEFAULT_CONSOLE_NAV);
    expect(parseConsoleNav('?')).toEqual(DEFAULT_CONSOLE_NAV);
  });

  test('parses playground chrome', () => {
    expect(
      parseConsoleNav('?section=playground&kind=api&view=commands')
    ).toEqual({
      section: 'playground',
      kind: 'api',
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
    expect(parseConsoleNav('?kind=api&view=sqlite').view).toBe('db');
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
    expect(parseConsoleNav('?kind=api&view=ui')).toEqual({
      section: 'reports',
      kind: 'api',
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
    expect(coerceView('api', 'topics')).toBe('db');
    expect(coerceView('events', 'ui')).toBe('events');
    expect(coerceView('room', 'commands')).toBe('db');
  });

  test('legacy kind=server/pubsub map to api/events', () => {
    expect(parseConsoleNav('?kind=server&view=commands')).toEqual({
      section: 'reports',
      kind: 'api',
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
        kind: 'api',
        instance: '',
        view: 'commands',
      })
    ).toBe('?section=playground&kind=api&view=commands');
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
      { kind: 'api' }
    );
    expect(next).toEqual({
      section: 'playground',
      kind: 'api',
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
      { kind: 'api', view: 'logs' }
    );
    expect(next.view).toBe('events');
  });
});
