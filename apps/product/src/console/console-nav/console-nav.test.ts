import { describe, expect, test } from 'bun:test';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  coerceView,
  DEFAULT_CONSOLE_NAV,
  DEFAULT_SIMULATOR_NAV,
  parseConsoleNav,
  resolvePaneNav,
} from '@apps/product/console-nav/console-nav';

describe('parseConsoleNav', () => {
  test('defaults when search empty', () => {
    expect(parseConsoleNav('')).toEqual(DEFAULT_CONSOLE_NAV);
    expect(parseConsoleNav('?')).toEqual(DEFAULT_CONSOLE_NAV);
  });

  test('parses simulator chrome into nested slice', () => {
    expect(
      parseConsoleNav('?section=simulator&kind=server&view=commands')
    ).toEqual({
      section: 'simulator',
      simulator: {
        kind: 'server',
        instance: '',
        panes: { server: { view: 'commands' } },
      },
      tests: DEFAULT_CONSOLE_NAV.tests,
    });
  });

  test('cv becomes full per-node pane map', () => {
    // Legacy client `db`/`logs` panes coerce to client's only view (`ui`),
    // drop out of the pane map as defaults, and no longer seed the instance.
    expect(parseConsoleNav('?kind=client&cv=alice:db,bob:logs')).toEqual({
      section: 'tests',
      simulator: {
        kind: 'client',
        instance: '',
        panes: {},
      },
      tests: DEFAULT_CONSOLE_NAV.tests,
    });
  });

  test('cv with legacy table segment is ignored', () => {
    const state = parseConsoleNav(
      '?section=simulator&cv=alice:db:auth_devices,bob:ui'
    );
    // Chrome kind defaults to client: both entries coerce to client's only
    // view (`ui`) and drop out of the pane map as defaults.
    expect(state.simulator.panes).toEqual({});
  });

  test('instance query wins over first cv id', () => {
    expect(parseConsoleNav('?kind=client&instance=bob&cv=alice:db')).toEqual({
      section: 'tests',
      simulator: {
        kind: 'client',
        instance: 'bob',
        // Legacy client `db` pane coerces to `ui` (client's only view) and
        // drops out of the pane map as a default.
        panes: {},
      },
      tests: DEFAULT_CONSOLE_NAV.tests,
    });
  });

  test('aliases html/sqlite/logs views', () => {
    expect(
      resolvePaneNav(parseConsoleNav('?kind=client&view=html').simulator, '')
        .view
    ).toBe('ui');
    expect(
      resolvePaneNav(
        parseConsoleNav('?kind=server&view=sqlite').simulator,
        'server'
      ).view
    ).toBe('db');
    expect(
      resolvePaneNav(
        parseConsoleNav('?kind=events&view=logs').simulator,
        'events'
      ).view
    ).toBe('events');
  });

  test('legacy client db/events panes drop out of cv', () => {
    // Client nodes only have a `ui` view now: legacy `alice:db` / `bob:logs`
    // coerce to `ui` and are omitted as defaults.
    const client = parseConsoleNav('?kind=client&cv=alice:db,bob:logs');
    expect(client.simulator.panes).toEqual({});
    // Under room chrome the implied kind for non-singleton panes is room, so
    // a legal non-default room view survives; instance seeds from first id.
    const room = parseConsoleNav('?kind=room&cv=alice:events');
    expect(room.simulator.panes['alice']).toEqual({ view: 'events' });
    expect(room.simulator.instance).toBe('alice');
  });

  test('ignores unknown enum values', () => {
    expect(parseConsoleNav('?section=x&kind=y&view=z')).toEqual({
      section: 'tests',
      simulator: DEFAULT_SIMULATOR_NAV,
      tests: DEFAULT_CONSOLE_NAV.tests,
    });
  });

  test('coerces illegal view for kind to default (omitted from panes)', () => {
    expect(parseConsoleNav('?kind=server&view=ui')).toEqual({
      section: 'tests',
      simulator: {
        kind: 'server',
        instance: '',
        panes: {},
      },
      tests: DEFAULT_CONSOLE_NAV.tests,
    });
    expect(
      resolvePaneNav(
        parseConsoleNav('?kind=server&view=ui').simulator,
        'server'
      ).view
    ).toBe('db');
  });

  test('parses reports slice independently', () => {
    const state = parseConsoleNav(
      '?section=simulator&kind=server&bucket=local&run=latest&test=auth&frame=3&node=alice&rview=ui'
    );
    expect(state.section).toBe('simulator');
    expect(state.simulator.kind).toBe('server');
    expect(state.tests).toEqual({
      bucketId: 'local',
      runId: 'latest',
      testId: 'auth',
      frame: 3,
      node: 'alice',
      view: 'ui',
    });
  });

  test('preserves unrelated query keys on round-trip', () => {
    const state = parseConsoleNav(
      '?section=simulator&kind=pubsub&view=topics&resetDb=1'
    );
    expect(buildConsoleSearch(state, '?resetDb=1&junk=2')).toBe(
      '?resetDb=1&junk=2&section=simulator&kind=events&cv=events%3Atopics'
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
    expect(parseConsoleNav('?host=console&section=simulator')).toEqual({
      section: 'simulator',
      simulator: DEFAULT_SIMULATOR_NAV,
      tests: DEFAULT_CONSOLE_NAV.tests,
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
        section: 'tests',
        simulator: DEFAULT_SIMULATOR_NAV,
        tests: DEFAULT_CONSOLE_NAV.tests,
      })
    ).toBe('');
  });

  test('drops chrome keys when returning to defaults', () => {
    expect(
      buildConsoleSearch(
        DEFAULT_CONSOLE_NAV,
        '?host=console&section=simulator&cv=alice:db&instance=bob&bucket=local&x=1'
      )
    ).toBe('?x=1');
  });

  test('round-trips reports without clobbering simulator', () => {
    const state = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      section: 'tests',
      simulator: {
        kind: 'server',
        instance: '',
        panes: { server: { view: 'commands' } },
      },
      tests: {
        bucketId: 'local',
        runId: 'latest',
        testId: 'space-end',
        frame: 2,
        node: 'alice',
        view: 'ui',
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
    expect(parseConsoleNav('?kind=api&view=commands').simulator).toEqual({
      kind: 'server',
      instance: '',
      panes: { server: { view: 'commands' } },
    });
    expect(parseConsoleNav('?kind=pubsub&view=topics').simulator).toEqual({
      kind: 'events',
      instance: '',
      panes: { events: { view: 'topics' } },
    });
    expect(
      buildConsoleSearch({
        section: 'simulator',
        simulator: {
          kind: 'server',
          instance: '',
          panes: { server: { view: 'commands' } },
        },
        tests: DEFAULT_CONSOLE_NAV.tests,
      })
    ).toBe('?section=simulator&kind=server&cv=server%3Acommands');
  });

  test('legacy kind=actor maps to room', () => {
    expect(parseConsoleNav('?kind=actor').simulator).toEqual({
      kind: 'room',
      instance: '',
      panes: {},
    });
  });

  test('kind change clears singleton instance and keeps panes', () => {
    const next = applyConsoleNavPatch(
      {
        section: 'simulator',
        simulator: {
          kind: 'client',
          instance: 'alice',
          panes: { alice: { view: 'ui' } },
        },
        tests: DEFAULT_CONSOLE_NAV.tests,
      },
      { kind: 'server' }
    );
    expect(next.simulator).toEqual({
      kind: 'server',
      instance: '',
      panes: { alice: { view: 'ui' } },
    });
    expect(resolvePaneNav(next.simulator, 'server').view).toBe('db');
  });

  test('explicit view wins when legal for new kind', () => {
    const next = applyConsoleNavPatch(
      {
        section: 'simulator',
        simulator: {
          kind: 'client',
          instance: '',
          panes: {},
        },
        tests: DEFAULT_CONSOLE_NAV.tests,
      },
      { kind: 'server', view: 'logs' }
    );
    expect(resolvePaneNav(next.simulator, 'server').view).toBe('events');
  });

  test('pane patch updates only that node', () => {
    const next = applyConsoleNavPatch(
      {
        section: 'simulator',
        simulator: {
          kind: 'server',
          instance: '',
          panes: {},
        },
        tests: DEFAULT_CONSOLE_NAV.tests,
      },
      {
        simulator: {
          pane: { id: 'server', patch: { view: 'db' } },
        },
      }
    );
    expect(resolvePaneNav(next.simulator, 'server').view).toBe('db');
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

  test('section change leaves simulator and tests intact', () => {
    const current = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      simulator: {
        kind: 'server',
        panes: { server: { view: 'commands' } },
      },
      tests: { bucketId: 'local', testId: 'demo' },
    });
    const next = applyConsoleNavPatch(current, { section: 'simulator' });
    expect(next.section).toBe('simulator');
    expect(next.simulator).toEqual(current.simulator);
    expect(next.tests).toEqual(current.tests);
  });
});
