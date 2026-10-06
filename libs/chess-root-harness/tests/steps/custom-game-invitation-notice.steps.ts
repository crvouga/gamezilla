import { expect } from 'bun:test';
import { customGameInvitationShown } from '@libs/chess-custom-game-harness/custom-game-play-reads';
import { Then } from '@libs/harness/define';
import { customSide } from './custom-game-choices.steps';
import { customGame, customPerson } from './custom-game-world';

Then(
  "{actor} sees {actor}'s invitation to play {word}",
  async (w, actor: string, creator: string, name: string) => {
    expect((await customGame(w)).creator).toBe(customPerson(w, creator));
    await w.s.until((s) =>
      customGameInvitationShown(s, actor, customSide(name))
    );
  }
);
Then(
  "{actor} does not see {actor}'s invitation to play {word}",
  async (w, actor: string, _creator: string, name: string) => {
    await w.s.until(
      (s) => customGameInvitationShown(s, actor, customSide(name)),
      { pred: (shown) => !shown }
    );
  }
);
