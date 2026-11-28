import { expect, test } from 'bun:test';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

// regression: finished-game-session-result-covers-search
test.each(['already open', 'opens at Back'])(
  'Alice dismisses the result (%s) before leaving the finished board to find an opponent',
  async (arrival) => {
    let place = 'board';
    let result = arrival === 'already open' ? 'open' : 'pending';
    const taps: string[] = [];
    const multiplayer = Handles.gameChoice('multiplayer');
    const ui = {
      get: (id: string) => ({
        isVisible: async () => {
          if (id === 'game-result-close') return result === 'open';
          if (id === 'game-session-content' || id === Handles.navBack)
            return place === 'board';
          if (id === multiplayer) return place === 'choices';
          return id === 'multiplayer-screen' && place === 'search';
        },
        layout: async () => null,
        attribute: async () => 'idle',
        tap: async () => {
          if (id === Handles.navBack && result === 'pending') result = 'open';
          if (result !== 'closed' && id !== 'game-result-close')
            throw new Error(
              'node nav-back tap: centre (30,28) hits ModalScrim < GameResultDialog'
            );
          taps.push(id);
          if (id === 'game-result-close') result = 'closing';
          if (id === Handles.navBack) place = 'choices';
          if (id === multiplayer) place = 'search';
        },
        expect: {
          hidden: async () => {
            expect([id, result]).toEqual(['game-result-close', 'closing']);
            result = 'closed';
          },
        },
      }),
    };
    const alice = {
      ui,
      currentPath: async () => '/space/friday',
      sessionToken: async () => null,
      memberId: async () => null,
    };
    const s = {
      actors: new Map([['alice', alice]]),
      harness: {
        client: async () => ({}),
        composition: { app: { turnGames: { games: [] } } },
      },
      session: {
        waitForIdle: async () => {},
        advanceTime: async () => {},
        scheduler: { virtual: true, starvedAdvances: () => 0 },
      },
    } as unknown as ProductHarness;
    await Promise.resolve(openFindingAnOpponent.act(s, 'alice', 'any-game'));
    expect(taps).toEqual(['game-result-close', Handles.navBack, multiplayer]);
    expect(place).toBe('search');
  }
);
