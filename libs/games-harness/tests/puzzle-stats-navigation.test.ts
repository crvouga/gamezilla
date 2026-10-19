import { expect, test } from 'bun:test';
import { showGamePuzzleStats } from '@libs/game-session-harness/puzzle-records';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

/**
 * A game's puzzle stats from outside its space, as the host's automatic
 * entry into their space comes at once or later: a driver fixture.
 */
function statsSurface(entryScreen: string) {
  let screen = 'lobby';
  const taps: string[] = [];
  const card = Handles.spaceCard('alice');
  const visible = (handle: string) => {
    if (handle === Handles.statusCurrentUser) return true;
    if (screen === 'lobby') {
      return [Handles.tabSpaces, Handles.spaceCreate, card].includes(handle);
    }
    if (screen === 'join') return handle === Handles.spaceJoin;
    if (screen === 'games') {
      return [Handles.spaceClose, Handles.gameMenu('chess')].includes(handle);
    }
    if (screen === 'chess') return handle === Handles.gameChoice('stats');
    return screen === 'stats' && handle === Handles.chessStatsElo;
  };
  const ui = {
    snapshotHtml: async () => `<div data-testid="${card}"></div>`,
    get: (handle: string) => ({
      isVisible: async () => visible(handle),
      expect: {
        visible: async () => {
          if (screen === 'loading' || screen === 'join') screen = 'games';
          expect(visible(handle)).toBe(true);
        },
      },
      tap: async () => {
        // Automatic entry can remove the prompt between a probe and a tap.
        if (screen === 'join') screen = 'games';
        expect(visible(handle)).toBe(true);
        taps.push(handle);
        if (handle === card) {
          screen = entryScreen;
        } else if (handle === Handles.gameMenu('chess')) screen = 'chess';
        else if (handle === Handles.gameChoice('stats')) screen = 'stats';
      },
    }),
  };
  const harness = {
    actors: new Map([['alice_phone', { ui }]]),
    session: {
      advanceTime: async () => {
        if (screen === 'loading' || screen === 'join') screen = 'games';
      },
      waitForIdle: async () => undefined,
      scheduler: { starvedAdvances: () => 0 },
    },
  } as unknown as ProductHarness;
  return { harness, taps, statsVisible: () => visible(Handles.chessStatsElo) };
}

// regression: chess-stats-host-auto-entry
test.each(['games', 'loading', 'join'])(
  'stats navigation when host entry initially shows %s',
  async (entryScreen) => {
    const surface = statsSurface(entryScreen);
    await Promise.resolve(
      showGamePuzzleStats.act(surface.harness, 'alice_phone', 'chess')
    );
    expect(surface.statsVisible()).toBe(true);
    expect(
      surface.taps.filter((handle) => handle === Handles.spaceJoin)
    ).toHaveLength(0);
  }
);
