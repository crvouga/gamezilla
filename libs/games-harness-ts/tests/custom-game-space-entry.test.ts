import { expect, test } from 'bun:test';
import { joinCustomGamesAsGuest } from '@libs/game-session-harness-ts/custom-game-lineup';
import { Handles } from '@libs/test-ids-shared-ts/handles';

function wordTilesSpace(joined: boolean) {
  const link = '/space/alice';
  const opened: string[] = [];
  const taps: string[] = [];
  const ui = {
    get: (handle: string) => ({
      isVisible: async () =>
        opened.length > 0 &&
        joined &&
        (handle === Handles.spaceActive || handle === 'custom-game-content'),
      text: async () => null,
      layout: async () => null,
      tap: async () => {
        taps.push(handle);
      },
      expect: {
        hidden: async () => {},
        visible: async () => {
          throw new Error('Join is absent');
        },
      },
    }),
    snapshotHtml: async () =>
      joined
        ? '<main data-screen="custom-games-home"></main>'
        : '<main data-screen="space-join"></main>',
  };
  const bob = {
    ui,
    openLink: async (path: string) => {
      opened.push(path);
    },
    browser: { currentUrl: async () => 'https://game.test/space/alice' },
  };
  const alice = { currentPath: async () => link };
  const s = {
    actors: new Map<string, typeof alice | typeof bob>([
      ['alice', alice],
      ['bob', bob],
    ]),
    session: {
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {},
      waitForIdle: async () => {},
    },
  } as never;
  return {
    enter: () =>
      Promise.resolve(
        joinCustomGamesAsGuest.act(s, 'word-tiles', 'alice', 'bob')
      ),
    opened,
    taps,
  };
}

// regression: word-tiles-custom-game-space-entry
test('Bob opening the Word Tiles space without an invitation verdict reports his screen before any Join', async () => {
  const { enter, opened, taps } = wordTilesSpace(false);
  await expect(enter()).rejects.toThrow(
    'bob opening the link (last saw no invitation outcome) at https://game.test/space/alice (screen: space-join)'
  );
  expect(opened).toEqual(['/space/alice']);
  expect(taps).toEqual([]);
});

test('Bob continues to Word Tiles when the space link takes him straight inside', async () => {
  const { enter, opened, taps } = wordTilesSpace(true);
  await expect(enter()).resolves.toBeUndefined();
  expect(opened).toEqual(['/space/alice']);
  expect(taps).toEqual([]);
});
