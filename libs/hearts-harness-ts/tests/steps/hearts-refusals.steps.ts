/**
 * What a person is told when Hearts refuses their pass or card: the reason
 * their screen gives for the refusal, which the room decided.
 */

import { expect } from 'bun:test';
import { Then } from '@libs/harness-ts/define';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { deciding, type HeartsWorld, sees, seesOnce } from './hearts-world';

/** `actor`'s screen refused for `reason`. */
async function refusedFor(
  w: HeartsWorld,
  actor: string,
  reason: string
): Promise<void> {
  const view = await seesOnce(w, actor, (shown) => shown.screen.error !== '');
  expect(view.screen.error).toBe(reason);
  expect(view.told).not.toBe('');
}

Then('{actor} is told there is no passing in this deal', (w, actor: string) =>
  refusedFor(w, actor, 'nothing to choose now')
);
Then(
  '{actor} is told he/she has already passed in this deal',
  (w, actor: string) => refusedFor(w, actor, 'already chosen')
);
Then(
  '{actor} is told the first trick begins once every player has passed',
  (w, actor: string) => refusedFor(w, actor, 'every side chooses first')
);
Then('{actor} is told the Hearts game is over', (w, actor: string) =>
  refusedFor(w, actor, 'finished')
);
Then(
  '{actor} is told a stand-in plays {heartsSeat} for him/her until he/she takes back his/her side',
  (w, actor: string) => refusedFor(w, actor, 'a stand-in plays your side')
);
Then(
  "{actor} is told it is {heartsSeat}'s turn",
  async (w, actor: string, side: GameSide) => {
    await refusedFor(w, actor, 'only the participant to move may play');
    expect(deciding(await sees(w, actor))).toBe(side);
  }
);
Then(
  '{actor} is told a pass is exactly three different cards',
  (w, actor: string) => refusedFor(w, actor, 'pass three different cards')
);
// The card named is the one the scenario's event proposed.
Then('{actor} is told he/she does not hold {heartsCard}', (w, actor: string) =>
  refusedFor(w, actor, 'not your card')
);
Then(
  '{actor} is told he/she must follow suit with a club',
  (w, actor: string) => refusedFor(w, actor, 'follow suit')
);
Then(
  '{actor} is told the first trick begins with the two of clubs',
  (w, actor: string) => refusedFor(w, actor, 'lead the two of clubs')
);
Then(
  '{actor} is told hearts and the queen of spades cannot be played on the first trick',
  (w, actor: string) => refusedFor(w, actor, 'no points on the first trick')
);
Then('{actor} is told hearts are not broken yet', (w, actor: string) =>
  refusedFor(w, actor, 'hearts not broken')
);
