import { expect } from 'bun:test';
import { readGameSessionName } from '@libs/game-session-harness-ts/game-session-names';
import {
  gameSessionInvitationShown,
  readGameSessionInvitation,
} from '@libs/game-session-harness-ts/game-session-reads';
import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { GAME_SESSION_SIDES } from '@libs/game-session-shared-ts/game-session-state';
import { Then, When } from '@libs/harness-ts/define';
import {
  choose,
  current,
  identityOf,
  race,
  toldOf,
} from './game-session-set-up-world';

When(
  '{actor} invites {actor} to the {gameSide}',
  async (w, host: string, person: string, side: GameSessionSide) =>
    choose(w, host, {
      operation: 'invite',
      side,
      person: await identityOf(w, person),
    })
);
When(
  '{actor} revokes the invitation to the {gameSide}',
  async (w, host: string, side: GameSessionSide) =>
    choose(w, host, { operation: 'revoke', side })
);
When(
  '{actor} accepts the invitation to the {gameSide}',
  async (w, person: string, side: GameSessionSide) =>
    choose(w, person, { operation: 'accept', side })
);
When(
  '{actor} declines the invitation to the {gameSide}',
  async (w, person: string, side: GameSessionSide) =>
    choose(w, person, { operation: 'decline', side })
);
When(
  '{actor} accepts the invitation to the {gameSide} while {actor} revokes it',
  async (w, person: string, side: GameSessionSide, host: string) =>
    race(w, [
      { actor: person, choice: { operation: 'accept', side } },
      { actor: host, choice: { operation: 'revoke', side } },
    ])
);

Then(
  "{actor} sees {actor}'s invitation to play the {gameSide}",
  async (w, person: string, creator: string, side: GameSessionSide) => {
    const game = await current(w);
    const creatorId = await identityOf(w, creator);
    expect(game.creator).toBe(creatorId);
    expect(
      await w.s.until((s) => gameSessionInvitationShown(s, person, side), {
        pred: (shown) => shown,
      })
    ).toBe(true);
    // The invitation names its creator as the creator's own seat shows them.
    const seated = GAME_SESSION_SIDES.find(
      (seat) => game[seat].person === creatorId
    );
    if (seated === undefined) return;
    const name = await w.s.read(readGameSessionName, creator, seated);
    expect(name).toBeTruthy();
    expect(
      await w.s.until((s) => readGameSessionInvitation(s, person, side), {
        pred: (text) => text?.includes(String(name)) === true,
      })
    ).toContain(String(name));
  }
);
Then(
  "{actor} does not see {actor}'s invitation to play the {gameSide}",
  async (w, person: string, _creator: string, side: GameSessionSide) => {
    expect(
      await w.s.until((s) => gameSessionInvitationShown(s, person, side), {
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
