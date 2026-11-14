import { describe, expect, test } from 'bun:test';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  consoleNavEqual,
  DEFAULT_CONSOLE_NAV,
  parseConsoleNav,
  resolvePaneNav,
} from '@apps/harness-ts/console-nav';

const SHOW = 'client:bob';

describe('parseConsoleNav', () => {
  test('defaults when search empty', () => {
    expect(parseConsoleNav('')).toEqual(DEFAULT_CONSOLE_NAV);
    expect(parseConsoleNav('?')).toEqual(DEFAULT_CONSOLE_NAV);
  });

  test('reads the panel on show', () => {
    const search = `?show=${encodeURIComponent(SHOW)}`;
    expect(parseConsoleNav(search).show).toBe(SHOW);
    expect(parseConsoleNav('?show=server%3Aserver-a').show).toBe(
      'server:server-a'
    );
  });

  test('an empty choice is the first client', () => {
    expect(parseConsoleNav('?show=').show).toBeNull();
    expect(parseConsoleNav('?show=%20').show).toBeNull();
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
      buildConsoleSearch(DEFAULT_CONSOLE_NAV, '?show=x&cv=lb:events')
    ).toBe('');
  });

  test('preserves unrelated query keys', () => {
    expect(buildConsoleSearch(DEFAULT_CONSOLE_NAV, '?debug=1')).toBe(
      '?debug=1'
    );
  });

  test('round-trips the panel on show and panes', () => {
    const state = {
      show: SHOW,
      switcher: DEFAULT_CONSOLE_NAV.switcher,
      panes: {
        'server:server-a': { view: 'events' },
        'room:lobby': { view: 'events' },
      },
    } as const;
    expect(parseConsoleNav(buildConsoleSearch(state))).toEqual(state);
  });
});

describe('applyConsoleNavPatch', () => {
  test('sets and clears the panel on show', () => {
    const set = applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, { show: SHOW });
    expect(set.show).toBe(SHOW);
    expect(applyConsoleNavPatch(set, { show: null })).toEqual(
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

describe('the switcher in the address', () => {
  test('nothing is written while it is every client and the harness app', () => {
    expect(parseConsoleNav('').switcher).toEqual({ added: [], removed: [] });
    expect(buildConsoleSearch(DEFAULT_CONSOLE_NAV, '?sw=lb')).toBe('');
  });

  test('a view put in and a client taken out survive the address', () => {
    let state = DEFAULT_CONSOLE_NAV;
    for (const [view, on] of [
      ['server:server-a', true],
      ['emulator:google', true],
      ['client:bob', false],
    ] as const)
      state = applyConsoleNavPatch(state, { switcher: { view, on } });
    const search = buildConsoleSearch(state);
    expect(search).toBe(
      '?sw=emulator%253Agoogle%2Cserver%253Aserver-a%2C-client%253Abob'
    );
    expect(consoleNavEqual(parseConsoleNav(search), state)).toBe(true);
    expect(parseConsoleNav(search).switcher).toEqual({
      added: ['emulator:google', 'server:server-a'],
      removed: ['client:bob'],
    });
  });

  test('what changes nothing is left out: a client put in, another view taken out', () => {
    expect(parseConsoleNav('?sw=client%3Aalice,-lb,,-').switcher).toEqual({
      added: [],
      removed: [],
    });
  });

  test('a change to it keeps the panel on show and its views', () => {
    const state = applyConsoleNavPatch(
      parseConsoleNav('?show=lb&cv=lb:events'),
      { switcher: { view: 'lb', on: true } }
    );
    expect(state.show).toBe('lb');
    expect(state.panes).toEqual({ lb: { view: 'events' } });
    expect(state.switcher.added).toEqual(['lb']);
  });
});
