import { expect } from 'bun:test';
import {
  chooseCustomGameWithKeyboard,
  listenToCustomGame,
  readCustomGameHeard,
} from '@libs/chess-custom-game-harness/custom-game-accessibility';
import { readCustomGameName } from '@libs/chess-custom-game-harness/custom-game-names';
import { customGameStartable } from '@libs/game-session-shared/custom-game-state';
import { Then, When } from '@libs/harness/define';
import { customGame, customPerson } from './custom-game-world';

When(
  '{actor} assigns a bot to Black in the Custom Game with the keyboard alone',
  async (w, actor: string) =>
    w.s.apply(chooseCustomGameWithKeyboard, actor, 'bot')
);
When(
  '{actor} starts the Custom Game with the keyboard alone',
  async (w, actor: string) =>
    w.s.apply(chooseCustomGameWithKeyboard, actor, 'start')
);
When('{actor} listens to the Custom Game', async (w, actor: string) =>
  w.s.apply(listenToCustomGame, actor)
);
Then(
  '{actor} hears White is {actor} and Black is a bot',
  async (w, actor: string, white: string) => {
    const heard = await w.s.read(readCustomGameHeard, actor);
    expect(heard.problems).toEqual([]);
    const game = await customGame(w, actor);
    expect(game.white.person).toBe(customPerson(w, white));
    expect(game.black.kind).toBe('bot');
    expect(heard.description).toContain(
      `White: ${await w.s.read(readCustomGameName, actor, 'white')}.`
    );
    expect(heard.description.toLowerCase()).toContain('black: bot');
  }
);
Then(
  '{actor} hears whether the Custom Game can start',
  async (w, actor: string) => {
    const heard = await w.s.read(readCustomGameHeard, actor);
    expect(heard.problems).toEqual([]);
    expect(heard.description).toContain(
      customGameStartable(await customGame(w, actor))
        ? 'Ready to start'
        : 'Waiting for participants and readiness'
    );
  }
);
Then(
  "{actor} hears the Custom Game's completed outcome",
  async (w, actor: string) => {
    const heard = await w.s.read(readCustomGameHeard, actor);
    const game = await customGame(w, actor);
    expect(heard.problems).toEqual([]);
    expect(game.status).toBe('completed');
    expect(heard.description).toContain(
      game.outcome === 'draw'
        ? 'Game drawn'
        : game.outcome.startsWith('white')
          ? 'White wins'
          : 'Black wins'
    );
  }
);
