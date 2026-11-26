import { expect, test } from 'bun:test';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { requestGameOpponent } from '@libs/game-matchmaking-harness-ts/multiplayer-search-ui';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import {
  openGameChoice,
  pickGame,
} from '@libs/game-session-harness-ts/game-navigation';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openConformanceHarness } from './conformance-world';

const tap = scenarioAction({
  name: 'tapGameSetupChoice',
  act: async (s, handle: string) =>
    (await actorUi(s, 'alice')).get(handle).tap(),
});

async function openGameMenu(game: string) {
  const s = await openConformanceHarness();
  try {
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(pickGame, 'alice', game);
    return s;
  } catch (error) {
    await s[Symbol.asyncDispose]();
    throw error;
  }
}

const modes = [
  { game: 'quoridor', mode: 'quoridor', seats: 2 },
  { game: 'quoridor', mode: 'quoridor-hill', seats: 4 },
  { game: 'connect-four', mode: 'connect-four', seats: 2 },
];

// regression: game-mode-on-main-menu
test.each(modes)(
  '$mode opens directly on seats for a person or a bot',
  async ({ game, mode, seats }) => {
    await using s = await openGameMenu(game);
    const ui = await s.read((world) => actorUi(world, 'alice'));
    expect(await ui.get(Handles.gameModes).isVisible()).toBe(false);
    expect(await ui.get(Handles.gameChoice('custom-game')).text()).toContain(
      'Custom games'
    );
    await s.apply(openGameChoice, 'alice', 'custom-game');
    await ui.get('custom-game-black-choices').expect.visible();
    if (game !== mode) await s.apply(tap, Handles.gameMode(mode));
    expect(await ui.get(Handles.gameModes).isVisible()).toBe(
      game === 'quoridor'
    );
    expect(await ui.get('custom-game-blue-choices').isVisible()).toBe(
      seats === 4
    );
    await s.apply(tap, 'custom-game-black-choices');
    await ui.get('custom-game-black-open').expect.visible();
    await ui.get('custom-game-black-invite-choose').expect.visible();
    await s.apply(tap, 'custom-game-black-bot');
    const current = await s.read(
      async (world) => (await customGameView(world, 'alice')).current
    );
    expect(current?.sides).toHaveLength(seats);
    expect(current?.black.kind).toBe('bot');
  },
  120_000
);

test.each(modes)(
  '$mode finds players for the selected mode',
  async ({ game, mode }) => {
    await using s = await openGameMenu(game);
    const ui = await s.read((world) => actorUi(world, 'alice'));
    expect(await ui.get(Handles.gameChoice('multiplayer')).text()).toContain(
      'Match making'
    );
    await s.apply(openGameChoice, 'alice', 'multiplayer');
    await ui.get('multiplayer-find').expect.visible();
    if (game !== mode) await s.apply(tap, Handles.gameMode(mode));
    expect(await ui.get(Handles.gameModes).isVisible()).toBe(
      game === 'quoridor'
    );
    await s.apply(requestGameOpponent, 'alice', '5+0');
    const found = await s.read((world) => multiplayerView(world, 'alice'));
    expect(found.search?.time_control).toBe(`${mode}/5+0`);
  },
  120_000
);
