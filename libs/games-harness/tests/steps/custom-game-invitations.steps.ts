import { expect } from 'bun:test';
import { customGameInvitationShown } from '@libs/game-session-harness/custom-game-reads';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Then, When } from '@libs/harness/define';
import {
  choose,
  current,
  identityOf,
  race,
  toldOf,
} from './custom-game-set-up-world';

When(
  '{actor} invites {actor} to the {gameSide}',
  async (w, host: string, person: string, side: CustomGameSide) =>
    choose(w, host, {
      operation: 'invite',
      side,
      person: await identityOf(w, person),
    })
);
When(
  '{actor} revokes the invitation to the {gameSide}',
  async (w, host: string, side: CustomGameSide) =>
    choose(w, host, { operation: 'revoke', side })
);
When(
  '{actor} accepts the invitation to the {gameSide}',
  async (w, person: string, side: CustomGameSide) =>
    choose(w, person, { operation: 'accept', side })
);
When(
  '{actor} declines the invitation to the {gameSide}',
  async (w, person: string, side: CustomGameSide) =>
    choose(w, person, { operation: 'decline', side })
);
When(
  '{actor} accepts the invitation to the {gameSide} while {actor} revokes it',
  async (w, person: string, side: CustomGameSide, host: string) =>
    race(w, [
      { actor: person, choice: { operation: 'accept', side } },
      { actor: host, choice: { operation: 'revoke', side } },
    ])
);

Then(
  "{actor} sees {actor}'s invitation to play the {gameSide}",
  async (w, person: string, creator: string, side: CustomGameSide) => {
    expect((await current(w)).creator).toBe(await identityOf(w, creator));
    expect(
      await w.s.until((s) => customGameInvitationShown(s, person, side), {
        pred: (shown) => shown,
      })
    ).toBe(true);
  }
);
Then(
  "{actor} does not see {actor}'s invitation to play the {gameSide}",
  async (w, person: string, _creator: string, side: CustomGameSide) => {
    expect(
      await w.s.until((s) => customGameInvitationShown(s, person, side), {
        pred: (shown) => !shown,
      })
    ).toBe(false);
  }
);

Then(
  '{actor} is told that side is not their invitation',
  async (w, actor: string) => toldOf(w, actor, 'not your invitation')
);
Then(
  '{actor} is told the person must be in the space',
  async (w, actor: string) => toldOf(w, actor, 'person not in the space')
);
