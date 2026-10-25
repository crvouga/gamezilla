/**
 * What a person is told when Hearts refuses their pass or card. Where the
 * games context already names the refusal in its own words (a secret choice
 * is a pass), the screen's reason is read; where only Hearts can say why (a
 * card that does not follow suit), the words the person reads must say it.
 */

import { expect } from 'bun:test';
import { Then } from '@libs/harness-ts/define';
import type { HeartsView } from '@libs/hearts-harness-ts/hearts-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { deciding, type HeartsWorld, sees, seesOnce } from './hearts-world';

const RANKS: Readonly<Record<string, string>> = {
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  T: 'ten',
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace',
};
const SUITS: Readonly<Record<string, string>> = {
  C: 'clubs',
  D: 'diamonds',
  S: 'spades',
  H: 'hearts',
};

/** A card as the scenario names it: `QS`, the queen of spades. */
function named(card: string): RegExp {
  return new RegExp(`${RANKS[card[0]!]} of ${SUITS[card[1]!]}`, 'i');
}

/** What `actor` is told, once their screen says anything. */
function told(w: HeartsWorld, actor: string): Promise<HeartsView> {
  return seesOnce(w, actor, (view) => view.screen.error !== '');
}

/** `actor` reads a refusal saying every one of `words`. */
async function toldIn(
  w: HeartsWorld,
  actor: string,
  words: readonly RegExp[]
): Promise<void> {
  const view = await told(w, actor);
  for (const word of words) expect(view.told).toMatch(word);
}

/** `actor`'s screen refused for `reason`. */
async function refusedFor(
  w: HeartsWorld,
  actor: string,
  reason: string
): Promise<void> {
  expect((await told(w, actor)).screen.error).toBe(reason);
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
  (w, actor: string) => toldIn(w, actor, [/exactly three/i, /different/i])
);
Then(
  '{actor} is told he/she does not hold {heartsCard}',
  (w, actor: string, card: string) =>
    toldIn(w, actor, [
      /(do|does) not hold|don't hold|doesn't hold/i,
      named(card),
    ])
);
Then(
  '{actor} is told he/she must follow suit with a club',
  (w, actor: string) => toldIn(w, actor, [/follow suit/i, /club/i])
);
Then(
  '{actor} is told the first trick begins with the two of clubs',
  (w, actor: string) => toldIn(w, actor, [/first trick/i, /two of clubs/i])
);
Then(
  '{actor} is told hearts and the queen of spades cannot be played on the first trick',
  (w, actor: string) =>
    toldIn(w, actor, [/hearts/i, /queen of spades/i, /first trick/i])
);
Then('{actor} is told hearts are not broken yet', (w, actor: string) =>
  toldIn(w, actor, [/hearts/i, /not broken/i])
);
