import { expect, test } from 'bun:test';
import {
  establishMultiplayerSearch,
  expectSharedMultiplayerGame,
  openMultiplayerJourney,
  prepareUnfinishedMultiplayerGame,
  startMultiplayerSearch,
} from '@libs/runtime-harness-ts/multiplayer-journey';
import {
  endMultiplayerSpace,
  retirePreviousMultiplayer,
} from '@libs/runtime-harness-ts/multiplayer-search-recovery';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

function loadingScreen(
  invitation: boolean,
  leftover = false
): { ui: Driver; taps: string[] } {
  let ongoing = leftover;
  let selected = 'multiplayer-time-control-2-1';
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('unexpected gesture');
  };
  const ui: Driver = {
    kind: 'loading-permission',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: async () =>
      `<label data-selected="true"><input data-testid="${selected}"></label>`,
    get: (id): DriverNode => ({
      get: unused,
      attribute: async () => (ongoing ? 'ongoing' : null),
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: async (key) => {
        expect(key).toBe('space');
        selected = id;
        taps.push(id);
      },
      scroll: unused,
      wait: unused,
      text: unused,
      isVisible: async () =>
        id === 'multiplayer-game' ||
        (id === 'multiplayer-abort' && ongoing) ||
        id === 'multiplayer-access-denial' ||
        (id === 'multiplayer-access-denial-action' && invitation),
      tap: async () => {
        if (ongoing && id === 'multiplayer-time-control-5-0')
          throw new Error('the previous game still owns the account');
        taps.push(id);
        if (id === 'multiplayer-confirm') ongoing = false;
      },
      expect: {
        hidden: async () => {},
        text: unused,
        visible: async () => {
          if (id === 'multiplayer-waiting') taps.push('waiting-row-shown');
        },
      },
    }),
  };
  return { ui, taps };
}

test('a loading permission surface does not count as a completed search', async () => {
  // regression: multiplayer-search-transient-denial
  const { ui, taps } = loadingScreen(false);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual(['multiplayer-time-control-5-0', 'multiplayer-find']);
});

test('a chess journey leaves Connect Four choices before finding an opponent', async () => {
  // regression: chess-journey-inherits-other-game-choice
  const { ui, taps } = loadingScreen(false);
  const get = ui.get.bind(ui);
  let choices = true;
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      isVisible: async () => {
        if (id === 'game-choice-multiplayer' || id === Handles.navBack)
          return choices;
        if (id === 'game-menu-chess') return !choices;
        return node.isVisible();
      },
      tap: async () => {
        taps.push(id);
        if (id === Handles.navBack) choices = false;
        if (id === 'game-menu-chess') choices = true;
      },
    };
  };
  await openMultiplayerJourney(ui);
  expect(taps).toEqual([
    Handles.navBack,
    'game-menu-chess',
    'game-choice-multiplayer',
  ]);
});

// regression: live-multiplayer-leftover-game
test('a monitor left in an unfinished game retires it before finding a new opponent', async () => {
  const { ui, taps } = loadingScreen(false, true);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([
    'multiplayer-abort',
    'multiplayer-confirm',
    'multiplayer-dismiss',
    'multiplayer-time-control-5-0',
    'multiplayer-find',
  ]);
});

test('an account invitation never starts a guest search', async () => {
  const { ui, taps } = loadingScreen(true);
  await startMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([]);
});

// regression: multiplayer-given-search-not-landed
test('a pre-existing search waits for its accepted waiting row before the next person searches', async () => {
  const { ui, taps } = loadingScreen(false);
  await establishMultiplayerSearch('5+0')(ui);
  expect(taps).toEqual([
    'multiplayer-time-control-5-0',
    'multiplayer-find',
    'waiting-row-shown',
  ]);
});

// regression: multiplayer-shared-game-was-finished
test('the same completed board on both devices is not a newly matched game', async () => {
  const { ui } = loadingScreen(false);
  ui.snapshotHtml = async () =>
    '<div data-testid="multiplayer-game" data-game-id="last-match" data-outcome="white"></div>';
  const get = ui.get.bind(ui);
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      expect: {
        ...node.expect,
        visible: async () => {
          if (id === 'multiplayer-abort')
            throw new Error('there is no ongoing game');
        },
      },
    };
  };
  const act = async (_name: string, gestures: (ui: Driver) => Promise<void>) =>
    gestures(ui);
  await expect(
    expectSharedMultiplayerGame(
      { act, actAsGuest: act, now: async () => 0 },
      5000
    )
  ).rejects.toThrow('no ongoing game');
});

// regression: multiplayer-recovery-given-inherits-pairing-deadline
test('recovery setup can establish its unfinished game beyond the separate timed pairing assertion', async () => {
  const { ui } = loadingScreen(false);
  ui.snapshotHtml = async () =>
    '<label data-selected="true"><input data-testid="multiplayer-time-control-5-0"></label><div data-testid="multiplayer-game" data-game-id="fresh-game" data-outcome="ongoing"></div>';
  const get = ui.get.bind(ui);
  const moves: string[] = [];
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      text: async () => 'White',
      layout: async () => ({ x: 0, y: 0, width: 400, height: 400 }),
      tapAt: async () => {},
      expect: {
        ...node.expect,
        text: async (value) => {
          moves.push(value);
        },
      },
    };
  };
  let elapsed = 0;
  const act = async (
    name: string,
    gestures: (driver: Driver) => Promise<void>
  ) => {
    await gestures(ui);
    if (name === 'observeMultiplayerGame') elapsed += 6000;
  };
  await prepareUnfinishedMultiplayerGame({
    runId: 'recovery-setup',
    now: async () => elapsed,
    elapse: async (milliseconds) => {
      elapsed += milliseconds;
    },
    browser: null,
    showsPuzzleAnswers: false,
    open: async () => {},
    openPeer: async () => {},
    peerDevice: {
      spaceLink: async () => '',
      reopen: async () => {},
      offline: async () => {},
      online: async () => {},
      anotherSignedInDevice: async () => {},
    },
    act,
    actAsGuest: act,
    spaceLink: async () => '',
    openLink: async () => {},
    openGuest: async () => {},
    offline: async () => {},
    online: async () => {},
    reopen: async () => {},
    defer: () => {},
    settle: () => {},
  });
  expect(moves).toEqual(['1. e4', '1. e4', '1. e4 e5']);
  expect(elapsed).toBe(12000);
});

// regression: failed-multiplayer-journey-leaves-search
test('cleanup stops a waiting search before ending its space', async () => {
  const { ui, taps } = loadingScreen(false);
  let waiting = true;
  const get = ui.get.bind(ui);
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      isVisible: async () =>
        id === 'multiplayer-stop' ? waiting : id === Handles.spaceEnd,
      tap: async (options) => {
        if (id === 'multiplayer-stop') waiting = false;
        await node.tap(options);
      },
    };
  };
  await endMultiplayerSpace(ui);
  expect(waiting).toBe(false);
  expect(taps).toEqual([
    'multiplayer-stop',
    Handles.spaceEnd,
    Handles.spaceEndConfirm,
    Handles.spaceMutationDismiss,
  ]);
});

// regression: live-multiplayer-wrong-time-control
test('a previous 2+1 choice is changed to the requested 5+0 before finding an opponent', async () => {
  const { ui, taps } = loadingScreen(false);
  await startMultiplayerSearch('5+0')(ui);
  expect(await ui.snapshotHtml()).toContain(
    'data-testid="multiplayer-time-control-5-0"'
  );
  expect(taps).toEqual(['multiplayer-time-control-5-0', 'multiplayer-find']);
});

test('an unchanged 2+1 radio refuses to start a search requested at 5+0', async () => {
  const { ui, taps } = loadingScreen(false);
  const get = ui.get.bind(ui);
  ui.get = (id) => ({ ...get(id), key: async () => {} });
  await expect(startMultiplayerSearch('5+0')(ui)).rejects.toThrow(
    '5+0 was not selected'
  );
  expect(taps).not.toContain('multiplayer-find');
});

async function matchedDuringStop(ongoing: boolean, matched: boolean) {
  const { ui, taps } = loadingScreen(false, ongoing);
  const get = ui.get.bind(ui);
  let searching = true;
  ui.get = (id) => {
    const node = get(id);
    return {
      ...node,
      isVisible: async () =>
        id === 'multiplayer-stop'
          ? searching
          : id === 'multiplayer-game'
            ? matched
            : node.isVisible(),
      tap: async (options) => {
        if (id === 'multiplayer-stop') {
          searching = false;
          throw new Error('the search control disappeared');
        }
        await node.tap(options);
      },
    };
  };
  return { ui, taps };
}

// regression: multiplayer-cleanup-search-matches-before-stop
test('cleanup retires the match that replaces a search before Stop receives its tap', async () => {
  const { ui, taps } = await matchedDuringStop(false, true);
  await retirePreviousMultiplayer(ui);
  expect(taps).toEqual([]);
});

test.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  'search transition ongoing=%s matched=%s preserves cleanup failures',
  async (ongoing, matched) => {
    const { ui, taps } = await matchedDuringStop(ongoing, matched);
    if (!matched) {
      await expect(retirePreviousMultiplayer(ui)).rejects.toThrow(
        'search control disappeared'
      );
      return;
    }
    await retirePreviousMultiplayer(ui);
    expect(taps).toEqual(
      ongoing
        ? ['multiplayer-abort', 'multiplayer-confirm', 'multiplayer-dismiss']
        : []
    );
  }
);
