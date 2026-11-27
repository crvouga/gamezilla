import { expect, test } from 'bun:test';
import { onMultiplayerPlace } from '@libs/game-matchmaking-harness-ts/multiplayer-places';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

// regression: matched-game-menu-covers-back
test('Alice reads the ending choices and closes their foreground menu while the stage Back is covered', async () => {
  let place = 'stage';
  const taps: string[] = [];
  const ui = {
    get: (id: string) => ({
      isVisible: async () =>
        id === 'multiplayer-screen' ||
        id === Handles.navBack ||
        (place === 'stage' && id === 'multiplayer-open-commands') ||
        (place === 'commands' &&
          ['multiplayer-resign', 'multiplayer-commands-close'].includes(id)),
      attribute: async (name: string) =>
        name === 'data-stage' ? 'playing' : place,
      tap: async () => {
        taps.push(id);
        if (place === 'stage' && id === 'multiplayer-open-commands')
          place = 'commands';
        else if (place === 'commands' && id === 'multiplayer-commands-close')
          place = 'stage';
        else throw new Error(`Cannot tap ${id} on ${place}`);
      },
    }),
  };
  const harness = {
    session: { scheduler: { virtual: true } },
    actors: new Map([['alice', { ui }]]),
  } as unknown as ProductHarness;
  expect(
    await onMultiplayerPlace(harness, 'alice', 'commands', () =>
      ui.get('multiplayer-resign').isVisible()
    )
  ).toBe(true);
  expect(taps).toEqual([
    'multiplayer-open-commands',
    'multiplayer-commands-close',
  ]);
  expect(place).toBe('stage');
});
