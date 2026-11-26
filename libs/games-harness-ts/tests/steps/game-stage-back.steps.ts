import { expect } from 'bun:test';
import {
  answerGameBack,
  gameBackOffered,
  goBackInGame,
} from '@libs/game-session-harness-ts/game-navigation';
import { Given, Then, When } from '@libs/harness-ts/define';

// regression: game-stage-back-minimizes-space
When('{actor} goes back from the board', (w, actor: string) =>
  w.s.apply(goBackInGame, actor)
);
Given(
  '{actor} has been asked whether to resign on her way back',
  async (w, actor: string) => {
    await w.s.apply(goBackInGame, actor);
    expect(await w.s.read(gameBackOffered, actor)).toBe('Resign game');
  }
);
When('{actor} chooses to keep playing', (w, actor: string) =>
  w.s.apply(answerGameBack, actor, 'stay')
);
When('{actor} confirms her resignation', (w, actor: string) =>
  w.s.apply(answerGameBack, actor, 'confirm')
);
Then(
  '{actor} is offered to resign or keep playing',
  async (w, actor: string) => {
    expect(await w.s.read(gameBackOffered, actor)).toBe('Resign game');
  }
);

Then(
  '{actor} is offered to abort or keep playing',
  async (w, actor: string) => {
    expect(await w.s.read(gameBackOffered, actor)).toBe('Abort game');
  }
);
