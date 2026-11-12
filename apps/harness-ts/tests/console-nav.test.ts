import { describe, expect, test } from 'bun:test';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  consoleNavEqual,
  DEFAULT_CONSOLE_NAV,
  parseConsoleNav,
  resolvePaneNav,
} from '@apps/harness-ts/console-nav';
import { createWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout';
import { serializeWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';

const LAYOUT = serializeWindowLayout(
  createWindowLayout({
    direction: 'row',
    children: [['client:alice'], ['lb', 'server:server-a']],
  })
);

describe('parseConsoleNav', () => {
  test('defaults when search empty', () => {
    expect(parseConsoleNav('')).toEqual(DEFAULT_CONSOLE_NAV);
    expect(parseConsoleNav('?')).toEqual(DEFAULT_CONSOLE_NAV);
  });

  test('reads the window layout', () => {
    const search = `?layout=${encodeURIComponent(LAYOUT)}`;
    expect(parseConsoleNav(search).layout).toBe(LAYOUT);
  });

  test('text that is not a layout is the starting arrangement', () => {
    expect(parseConsoleNav('?layout=nonsense').layout).toBeNull();
  });

  test('cv gives each panel its view', () => {
    expect(
      parseConsoleNav('?cv=server%3Aserver-a:commands,events:topics').panes
    ).toEqual({
      'server:server-a': { view: 'commands' },
      events: { view: 'topics' },
    });
  });

  test('a view the panel does not have, or its first view, is left out', () => {
    expect(
      parseConsoleNav('?cv=client:alice:db,lb:routes,events:nope,:db,x').panes
    ).toEqual({});
  });
});

describe('buildConsoleSearch', () => {
  test('omits defaults and drops its keys when back at them', () => {
    expect(buildConsoleSearch(DEFAULT_CONSOLE_NAV)).toBe('');
    expect(
      buildConsoleSearch(DEFAULT_CONSOLE_NAV, '?layout=x&cv=lb:events')
    ).toBe('');
  });

  test('preserves unrelated query keys', () => {
    expect(buildConsoleSearch(DEFAULT_CONSOLE_NAV, '?debug=1')).toBe(
      '?debug=1'
    );
  });

  test('round-trips layout and panes', () => {
    const state = {
      layout: LAYOUT,
      panes: {
        'server:server-a': { view: 'events' },
        'room:lobby': { view: 'events' },
      },
    } as const;
    expect(parseConsoleNav(buildConsoleSearch(state))).toEqual(state);
  });
});

describe('applyConsoleNavPatch', () => {
  test('sets and clears the layout', () => {
    const set = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, { layout: LAYOUT });
    expect(set.layout).toBe(LAYOUT);
    expect(applyConsoleNavPatch(set, { layout: null })).toEqual(
      DEFAULT_CONSOLE_NAV
    );
  });

  test('patches one pane and keeps the others', () => {
    const one = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      pane: { id: 'lb', patch: { view: 'events' } },
    });
    const two = applyConsoleNavPatch(one, {
      pane: { id: 'events', patch: { view: 'topics' } },
    });
    expect(two.panes).toEqual({
      lb: { view: 'events' },
      events: { view: 'topics' },
    });
    expect(resolvePaneNav(two, 'lb')).toEqual({ view: 'events' });
    expect(resolvePaneNav(two, 'server:server-a')).toEqual({ view: 'db' });
  });

  test('a pane back on its first view compares equal to the default', () => {
    const away = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      pane: { id: 'lb', patch: { view: 'events' } },
    });
    const back = applyConsoleNavPatch(away, {
      pane: { id: 'lb', patch: { view: 'routes' } },
    });
    expect(consoleNavEqual(away, DEFAULT_CONSOLE_NAV)).toBe(false);
    expect(consoleNavEqual(back, DEFAULT_CONSOLE_NAV)).toBe(true);
  });
});
