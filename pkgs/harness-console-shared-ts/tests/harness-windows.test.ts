import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_HARNESS_SWITCHER,
  HARNESS_APP_VIEW,
  type HarnessSwitch,
  harnessApps,
  harnessEmulatorPanelId,
  harnessPanelKind,
  harnessPanels,
  harnessSwitcherWith,
  harnessSwitchOf,
  harnessSwitchTarget,
  inHarnessSwitcher,
  resolveHarnessView,
  shownHarnessClient,
  steppedHarnessApp,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

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

const VIEWS = [...ids(), harnessEmulatorPanelId('google'), HARNESS_APP_VIEW];

describe('the switcher', () => {
  test("goes through each client's app, then the harness app, and around again", () => {
    expect(harnessApps(VIEWS)).toEqual([
      'client:alice',
      'client:bob',
      HARNESS_APP_VIEW,
    ]);
    expect(steppedHarnessApp('client:alice', VIEWS, 1)).toBe('client:bob');
    expect(steppedHarnessApp('client:bob', VIEWS, 1)).toBe(HARNESS_APP_VIEW);
    expect(steppedHarnessApp(HARNESS_APP_VIEW, VIEWS, 1)).toBe('client:alice');
    expect(steppedHarnessApp('client:alice', VIEWS, -1)).toBe(HARNESS_APP_VIEW);
  });

  test('from a view the harness app opened, it goes back to the harness app', () => {
    for (const view of ['emulator:google', 'server:server-a', 'lb', null])
      for (const step of [1, -1] as const)
        expect(steppedHarnessApp(view, VIEWS, step)).toBe(HARNESS_APP_VIEW);
    expect(resolveHarnessView('emulator:google', VIEWS)).toBe(
      'emulator:google'
    );
    expect(resolveHarnessView(HARNESS_APP_VIEW, VIEWS)).toBe(HARNESS_APP_VIEW);
    expect(shownHarnessClient('emulator:google')).toBeNull();
    expect(shownHarnessClient(HARNESS_APP_VIEW)).toBeNull();
  });

  test('with no harness app it is the clients alone, and with nothing there is nowhere to go', () => {
    expect(steppedHarnessApp('server:server-a', ids(), 1)).toBe('client:alice');
    const alone = ids({ ...WORLD, clients: ['alice'] });
    expect(steppedHarnessApp('client:alice', alone, 1)).toBe('client:alice');
    expect(steppedHarnessApp('lb', ids({ ...WORLD, clients: [] }), 1)).toBe(
      null
    );
  });

  test('a view is put in the switcher or taken out of it; the harness app never is', () => {
    let choice = DEFAULT_HARNESS_SWITCHER;
    choice = harnessSwitcherWith(choice, 'emulator:google', true);
    choice = harnessSwitcherWith(choice, 'server:server-a', true);
    choice = harnessSwitcherWith(choice, 'client:alice', false);
    choice = harnessSwitcherWith(choice, HARNESS_APP_VIEW, false);
    // In the order the views are listed, the harness app last.
    expect(harnessApps(VIEWS, choice)).toEqual([
      'client:bob',
      'server:server-a',
      'emulator:google',
      HARNESS_APP_VIEW,
    ]);
    expect(inHarnessSwitcher('client:alice', choice)).toBe(false);
    expect(inHarnessSwitcher('lb', choice)).toBe(false);
    expect(steppedHarnessApp('client:bob', VIEWS, 1, choice)).toBe(
      'server:server-a'
    );
    expect(steppedHarnessApp('client:alice', VIEWS, 1, choice)).toBe(
      HARNESS_APP_VIEW
    );
    expect(
      harnessSwitchTarget({ to: 'app', at: 2 }, 'client:bob', VIEWS, choice)
    ).toBe('emulator:google');
    // Putting back what was taken out, and the reverse, is the start again.
    choice = harnessSwitcherWith(choice, 'client:alice', true);
    choice = harnessSwitcherWith(choice, 'server:server-a', false);
    choice = harnessSwitcherWith(choice, 'emulator:google', false);
    expect(choice).toEqual(DEFAULT_HARNESS_SWITCHER);
  });

  test('any views, any changes: the switcher holds exactly the views last put in it', () => {
    assertProperty(
      'the last change to a view decides whether it is in the switcher',
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...VIEWS), fc.boolean()), {
          maxLength: 30,
        }),
        (changes) => {
          let choice = DEFAULT_HARNESS_SWITCHER;
          const want = new Map(
            VIEWS.map((view) => [view, inHarnessSwitcher(view)])
          );
          for (const [view, on] of changes) {
            choice = harnessSwitcherWith(choice, view, on);
            if (view !== HARNESS_APP_VIEW) want.set(view, on);
          }
          expect(harnessApps(VIEWS, choice)).toEqual(
            VIEWS.filter((view) => want.get(view) === true)
          );
        }
      )
    );
  });

  test('any number of clients: forward visits every app once before it repeats, and back undoes forward', () => {
    assertProperty(
      'the switcher is a cycle over the apps',
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 8 }),
        (clients) => {
          const views = [
            ...ids({ ...WORLD, clients }),
            'emulator:stripe',
            HARNESS_APP_VIEW,
          ];
          const apps = harnessApps(views);
          expect(apps).toHaveLength(clients.length + 1);
          let shown: string | null = apps[0] ?? null;
          const seen: (string | null)[] = [];
          for (const _ of apps) {
            seen.push(shown);
            const next = steppedHarnessApp(shown, views, 1);
            expect(steppedHarnessApp(next, views, -1)).toBe(shown);
            shown = next;
          }
          expect(seen).toEqual([...apps]);
          expect(shown).toBe(apps[0] ?? null);
        }
      )
    );
  });
});

describe("the switcher's keys", () => {
  const key = (code: string, held: Partial<Record<string, boolean>> = {}) => ({
    code,
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...held,
  });

  test('Alt with a bracket steps, with a digit names an app, with 0 the harness app', () => {
    expect(harnessSwitchOf(key('BracketRight'))).toEqual({ to: 'next' });
    expect(harnessSwitchOf(key('BracketLeft'))).toEqual({ to: 'previous' });
    expect(harnessSwitchOf(key('Digit1'))).toEqual({ to: 'app', at: 0 });
    expect(harnessSwitchOf(key('Digit9'))).toEqual({ to: 'app', at: 8 });
    expect(harnessSwitchOf(key('Digit0'))).toEqual({ to: 'harness' });
  });

  test("without Alt, with another modifier, or on another key, the press is the app's", () => {
    expect(harnessSwitchOf(key('BracketRight', { altKey: false }))).toBeNull();
    for (const held of ['ctrlKey', 'metaKey', 'shiftKey'])
      expect(harnessSwitchOf(key('Digit1', { [held]: true }))).toBeNull();
    expect(harnessSwitchOf(key('KeyK'))).toBeNull();
    expect(harnessSwitchOf(key('Numpad1'))).toBeNull();
    expect(harnessSwitchOf({ ...key(''), code: undefined })).toBeNull();
  });

  test('a switch goes to its app, and to none that is not there', () => {
    const to = (asked: HarnessSwitch, shown: string | null = 'client:alice') =>
      harnessSwitchTarget(asked, shown, VIEWS);
    expect(to({ to: 'next' })).toBe('client:bob');
    expect(to({ to: 'previous' })).toBe(HARNESS_APP_VIEW);
    expect(to({ to: 'harness' })).toBe(HARNESS_APP_VIEW);
    expect(to({ to: 'app', at: 1 })).toBe('client:bob');
    expect(to({ to: 'app', at: 2 })).toBe(HARNESS_APP_VIEW);
    expect(to({ to: 'app', at: 7 })).toBeNull();
    expect(harnessSwitchTarget({ to: 'harness' }, 'lb', ids())).toBeNull();
  });
});

describe('shownHarnessClient', () => {
  test("names the client whose app is on show, when a client's is", () => {
    expect(shownHarnessClient('client:bob')).toBe('bob');
    expect(shownHarnessClient('server:server-a')).toBeNull();
    expect(shownHarnessClient(null)).toBeNull();
  });
});
