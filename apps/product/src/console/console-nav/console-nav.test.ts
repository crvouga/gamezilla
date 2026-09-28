import { describe, expect, test } from 'bun:test';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  coerceView,
  DEFAULT_CONSOLE_NAV,
  DEFAULT_HARNESS_NAV,
  parseConsoleNav,
  resolvePaneNav,
} from '@apps/product/console-nav/console-nav';

describe('parseConsoleNav', () => {
  test('defaults when search empty', () => {
    expect(parseConsoleNav('')).toEqual(DEFAULT_CONSOLE_NAV);
    expect(parseConsoleNav('?')).toEqual(DEFAULT_CONSOLE_NAV);
  });

  test('parses harness chrome into nested slice', () => {
    expect(
      parseConsoleNav('?section=harness&kind=server&view=commands')
    ).toEqual({
      harness: {
        kind: 'server',
        instance: '',
        panes: { server: { view: 'commands' } },
      },
    });
  });

  test('cv becomes full per-node pane map', () => {
    // Legacy client `db`/`logs` panes coerce to client's only view (`ui`),
    // drop out of the pane map as defaults, and no longer seed the instance.
    expect(parseConsoleNav('?kind=client&cv=alice:db,bob:logs')).toEqual({
      harness: {
        kind: 'client',
        instance: '',
        panes: {},
      },
    });
  });

  test('cv with legacy table segment is ignored', () => {
    const state = parseConsoleNav(
      '?section=harness&cv=alice:db:auth_devices,bob:ui'
    );
    // Chrome kind defaults to client: both entries coerce to client's only
    // view (`ui`) and drop out of the pane map as defaults.
    expect(state.harness.panes).toEqual({});
  });

  test('instance query wins over first cv id', () => {
    expect(parseConsoleNav('?kind=client&instance=bob&cv=alice:db')).toEqual({
      harness: {
        kind: 'client',
        instance: 'bob',
        // Legacy client `db` pane coerces to `ui` (client's only view) and
        // drops out of the pane map as a default.
        panes: {},
      },
    });
  });

  test('aliases html/sqlite/logs views', () => {
    expect(
      resolvePaneNav(parseConsoleNav('?kind=client&view=html').harness, '').view
    ).toBe('ui');
    expect(
      resolvePaneNav(
        parseConsoleNav('?kind=server&view=sqlite').harness,
        'server'
      ).view
    ).toBe('db');
    expect(
      resolvePaneNav(
        parseConsoleNav('?kind=events&view=logs').harness,
        'events'
      ).view
    ).toBe('events');
  });

  test('legacy client db/events panes drop out of cv', () => {
    // Client nodes only have a `ui` view now: legacy `alice:db` / `bob:logs`
    // coerce to `ui` and are omitted as defaults.
    const client = parseConsoleNav('?kind=client&cv=alice:db,bob:logs');
    expect(client.harness.panes).toEqual({});
    // Under room chrome the implied kind for non-singleton panes is room, so
    // a legal non-default room view survives; instance seeds from first id.
    const room = parseConsoleNav('?kind=room&cv=alice:events');
    expect(room.harness.panes['alice']).toEqual({ view: 'events' });
    expect(room.harness.instance).toBe('alice');
  });

  test('ignores unknown enum values', () => {
    expect(parseConsoleNav('?section=x&kind=y&view=z')).toEqual({
      harness: DEFAULT_HARNESS_NAV,
    });
  });

  test('coerces illegal view for kind to default (omitted from panes)', () => {
    expect(parseConsoleNav('?kind=server&view=ui')).toEqual({
      harness: {
        kind: 'server',
        instance: '',
        panes: {},
      },
    });
    expect(
      resolvePaneNav(parseConsoleNav('?kind=server&view=ui').harness, 'server')
        .view
    ).toBe('db');
  });

  test('drops legacy section / report-tab keys', () => {
    const state = parseConsoleNav(
      '?section=tests&kind=server&bucket=local&run=latest&test=auth&frame=3&node=alice&rview=ui'
    );
    expect(state.harness.kind).toBe('server');
    expect(buildConsoleSearch(state)).toBe('?kind=server');
  });

  test('preserves unrelated query keys on round-trip', () => {
    const state = parseConsoleNav(
      '?section=harness&kind=pubsub&view=topics&resetDb=1'
    );
    expect(buildConsoleSearch(state, '?resetDb=1&junk=2')).toBe(
      '?resetDb=1&junk=2&kind=events&cv=events%3Atopics'
    );
  });

  test('round-trips instance and panes via cv (drops legacy table)', () => {
    const state = parseConsoleNav(
      '?kind=client&instance=bob&cv=bob:events,alice:db:auth_users'
    );
    // Stale client panes coerce to `ui` (client's only view) and drop out of
    // the pane map; the instance query is preserved.
    expect(buildConsoleSearch(state)).toBe('?instance=bob');
  });

  test('ignores legacy host query', () => {
    expect(parseConsoleNav('?host=console&section=harness')).toEqual({
      harness: DEFAULT_HARNESS_NAV,
    });
  });
});

describe('buildConsoleSearch', () => {
  test('omits defaults', () => {
    expect(buildConsoleSearch(DEFAULT_CONSOLE_NAV)).toBe('');
  });

  test('omits default section/kind with empty panes', () => {
    expect(
      buildConsoleSearch({
        harness: DEFAULT_HARNESS_NAV,
      })
    ).toBe('');
  });

  test('drops chrome keys when returning to defaults', () => {
    expect(
      buildConsoleSearch(
        DEFAULT_CONSOLE_NAV,
        '?host=console&section=harness&cv=alice:db&instance=bob&bucket=local&x=1'
      )
    ).toBe('?x=1');
  });

  test('round-trips harness chrome', () => {
    const state = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      harness: {
        kind: 'server',
        instance: '',
        panes: { server: { view: 'commands' } },
      },
    });
    const search = buildConsoleSearch(state);
    expect(parseConsoleNav(search)).toEqual(state);
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
    expect(parseConsoleNav('?kind=api&view=commands').harness).toEqual({
      kind: 'server',
      instance: '',
      panes: { server: { view: 'commands' } },
    });
    expect(parseConsoleNav('?kind=pubsub&view=topics').harness).toEqual({
      kind: 'events',
      instance: '',
      panes: { events: { view: 'topics' } },
    });
    expect(
      buildConsoleSearch({
        harness: {
          kind: 'server',
          instance: '',
          panes: { server: { view: 'commands' } },
        },
      })
    ).toBe('?kind=server&cv=server%3Acommands');
  });

  test('legacy kind=actor maps to room', () => {
    expect(parseConsoleNav('?kind=actor').harness).toEqual({
      kind: 'room',
      instance: '',
      panes: {},
    });
  });

  test('kind change clears singleton instance and keeps panes', () => {
    const next = applyConsoleNavPatch(
      {
        harness: {
          kind: 'client',
          instance: 'alice',
          panes: { alice: { view: 'ui' } },
        },
      },
      { kind: 'server' }
    );
    expect(next.harness).toEqual({
      kind: 'server',
      instance: '',
      panes: { alice: { view: 'ui' } },
    });
    expect(resolvePaneNav(next.harness, 'server').view).toBe('db');
  });

  test('explicit view wins when legal for new kind', () => {
    const next = applyConsoleNavPatch(
      {
        harness: {
          kind: 'client',
          instance: '',
          panes: {},
        },
      },
      { kind: 'server', view: 'logs' }
    );
    expect(resolvePaneNav(next.harness, 'server').view).toBe('events');
  });

  test('pane patch updates only that node', () => {
    const next = applyConsoleNavPatch(
      {
        harness: {
          kind: 'server',
          instance: '',
          panes: {},
        },
      },
      {
        harness: {
          pane: { id: 'server', patch: { view: 'db' } },
        },
      }
    );
    expect(resolvePaneNav(next.harness, 'server').view).toBe('db');
  });

  test('client panes coerce to the ui default (no db/events tabs)', () => {
    // Resolve-time coercion: a stale client pane coerces to client's only
    // legal view (`ui`), which is also the default — no db/events tabs.
    expect(
      resolvePaneNav(
        { kind: 'client', instance: 'alice', panes: { alice: { view: 'db' } } },
        'alice'
      ).view
    ).toBe('ui');
  });
});
