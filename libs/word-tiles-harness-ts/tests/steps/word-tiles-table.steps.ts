import { expect } from 'bun:test';
import {
  boardLetters,
  challengePublished,
  challengeSolved,
  exchangeTiles,
  lastRefusal,
  lastScore,
  lettersBetween,
  openChallenge,
  type Placement,
  passTurn,
  placeTiles,
  placeWord,
  publishChallenge,
  rackLetters,
  startTable,
  viewOf,
} from '@libs/word-tiles-harness-ts/word-tiles-table';
import { Given, Then, When } from './world';

type Span = {
  readonly word: string;
  readonly from: string;
  readonly to: string;
};

/** Letters in the order a rack is compared: sorted. */
const sorted = (letters: string) => [...letters].sort().join('');
const BOB_RACK = 'EEEEEEE';
const COUNTS: Readonly<Record<string, number>> = { two: 2, six: 6, seven: 7 };
const SEATS = ['alice', 'bob', 'carol', 'dave'];

/** Each refusal a person is told, as the game's rules name it. */
const REFUSALS: Readonly<Record<string, string>> = {
  'her first word must cover the centre square': 'must cover the centre',
  'her word must join the tiles on the board': 'not connected',
  'her tiles must lie in one line': 'not in one line',
  'the bag holds too few tiles to exchange':
    'too few tiles in the bag to exchange',
  'it is not his turn': 'not your turn',
  'the game is over': 'the game is over',
  'he does not hold those tiles': 'not your tiles',
  'her placement does not reach the target': 'witness',
};

function across(span: Span): readonly [string, 'across' | 'down', string] {
  return [
    span.from,
    span.from[0] === span.to[0] ? 'down' : 'across',
    span.word,
  ];
}

Given(
  'Alice and Bob have started Word Tiles with Alice holding {tiles}',
  (w, rack: string) => w.run.apply(startTable, { racks: [rack, BOB_RACK] })
);
Given(
  'Alice and Bob have started Word Tiles with Alice holding {tiles} and Alice has passed',
  async (w, rack: string) => {
    await w.run.apply(startTable, { racks: [rack, BOB_RACK] });
    await w.run.apply(passTurn, 'alice');
  }
);
Given(
  'Alice and Bob are playing Word Tiles with {word} tiles in the bag and Alice holding {tiles}',
  (w, count: string, rack: string) =>
    w.run.apply(startTable, {
      racks: [rack, BOB_RACK],
      bag: COUNTS[count] ?? 0,
    })
);
Given(
  'the board shows {wordSpan} with Alice holding {tiles}',
  (w, span: Span, rack: string) =>
    w.run.apply(startTable, { racks: [rack, BOB_RACK], words: [across(span)] })
);
Given(
  'the board shows {wordSpan} and {wordSpan} with Alice holding {tiles}',
  (w, first: Span, second: Span, rack: string) =>
    w.run.apply(startTable, {
      racks: [rack, BOB_RACK],
      words: [across(first), across(second)],
    })
);
Given(
  'Alice has 10 points and holds A and T, Bob has 30 points and holds Q and Z, the bag is empty and C is on the board on h7',
  (w) =>
    w.run.apply(startTable, {
      racks: ['AT', 'QZ'],
      bag: 0,
      scores: [10, 30],
      words: [['h7', 'down', 'C']],
    })
);
Given('Alice has gone out and the game is over', async (w) => {
  await w.run.apply(startTable, {
    racks: ['AT', 'QZ'],
    bag: 0,
    words: [['h7', 'down', 'C']],
  });
  await w.run.apply(placeTiles, 'alice', [
    { letter: 'A', square: 'h8' },
    { letter: 'T', square: 'h9' },
  ]);
  expect((await w.run.read(viewOf, 'bob')).position.ended).toBe('out');
});
Given(
  'Alice and Bob have passed five turns in a row with Alice holding {tiles} and Bob holding {tiles}',
  (w, alice: string, bob: string) =>
    w.run.apply(startTable, { racks: [alice, bob], scoreless: 5 })
);
Given(
  'Alice and Bob have passed five turns in a row with Alice holding {tiles}',
  (w, alice: string) =>
    w.run.apply(startTable, { racks: [alice, BOB_RACK], scoreless: 5 })
);
Given(
  'Alice is trying the one-move challenge with a rack of {tiles} and a target of {int} points on an empty board',
  (w, rack: string, target: number) => w.run.apply(openChallenge, rack, target)
);
Given(
  'Alice has made a one-move challenge with a rack of {tiles} and a target of {int} points on an empty board',
  (w, rack: string, target: number) => w.run.apply(openChallenge, rack, target)
);

When('{actor} places {wordSpan}', (w, actor: string, span: Span) =>
  w.run.apply(placeWord, actor, span.word, span)
);
When(
  '{actor} places {wordSpan} with the blank as {word}',
  (w, actor: string, span: Span, as: string) =>
    w.run.apply(placeWord, actor, span.word, { ...span, blankAs: as })
);
When(
  '{actor} places {tilePlacements}',
  (w, actor: string, placements: readonly Placement[]) =>
    w.run.apply(placeTiles, actor, placements)
);
When('{actor} passes', (w, actor: string) => w.run.apply(passTurn, actor));
When('{actor} exchanges {tiles}', (w, actor: string, letters: string) =>
  w.run.apply(exchangeTiles, actor, letters)
);
When(
  'Alice publishes the challenge with her placement of {wordSpan}',
  (w, span: Span) => w.run.apply(publishChallenge, span.word, span)
);

Then('the board shows {wordSpan}', async (w, span: Span) => {
  expect(await w.run.read(lettersBetween, span.from, span.to)).toBe(span.word);
});
Then(
  'the board shows {wordSpan} and {wordSpan}',
  async (w, a: Span, b: Span) => {
    expect(await w.run.read(lettersBetween, a.from, a.to)).toBe(a.word);
    expect(await w.run.read(lettersBetween, b.from, b.to)).toBe(b.word);
  }
);
Then('the board still shows only {wordSpan}', async (w, span: Span) => {
  expect(await w.run.read(lettersBetween, span.from, span.to)).toBe(span.word);
  expect(await w.run.read(boardLetters)).toBe(span.word);
});
Then('the board is still empty', async (w) => {
  expect(await w.run.read(boardLetters)).toBe('');
});
Then(
  'the board shows the blank as {word} on {boardSquare}',
  async (w, letter: string, at: string) => {
    expect(await w.run.read(lettersBetween, at, at)).toBe(letter.toLowerCase());
  }
);
Then('{actor} has the turn', async (w, actor: string) => {
  expect((await w.run.read(viewOf, actor)).position.turn).toBe(
    SEATS.indexOf(actor)
  );
});
Then(
  '{actor} is told {wordTilesRefusal}',
  async (w, _actor: string, refusal: string) => {
    expect(await w.run.read(lastRefusal)).toBe(REFUSALS[refusal] ?? refusal);
  }
);
Then(
  '{actor} is told {tileWord} is not in the word list',
  async (w, _actor: string, word: string) => {
    expect(await w.run.read(lastRefusal)).toBe(`not in the word list: ${word}`);
  }
);
Then('{actor} still holds {tiles}', async (w, actor: string, rack: string) => {
  expect(await w.run.read(rackLetters, actor)).toBe(sorted(rack));
});
Then('{actor} holds {word} tiles', async (w, actor: string, count: string) => {
  expect(await w.run.read(rackLetters, actor)).toHaveLength(
    COUNTS[count] ?? -1
  );
});
Then('{actor} holds seven tiles without Q or Z', async (w, actor: string) => {
  const rack = await w.run.read(rackLetters, actor);
  expect([rack.length, rack.includes('Q'), rack.includes('Z')]).toEqual([
    7,
    false,
    false,
  ]);
});
Then('the bag holds {int} tiles', async (w, count: number) => {
  expect((await w.run.read(viewOf, 'alice')).position.bag).toBe(count);
});
Then(
  '{actor} scores {int} points',
  async (w, _actor: string, points: number) => {
    expect((await w.run.read(lastScore))?.score).toBe(points);
  }
);
Then(
  'Alice scores {int} points for {tileWord} and {tileWord}',
  async (w, points: number, a: string, b: string) => {
    const last = await w.run.read(lastScore);
    expect([last?.score, [...(last?.words ?? [])].sort()]).toEqual([
      points,
      [a, b].sort(),
    ]);
  }
);
Then('the game is over', async (w) => {
  expect((await w.run.read(viewOf, 'alice')).position.ended).not.toBeNull();
});
Then(
  'Alice has {int} points and Bob has {int} points',
  async (w, alice: number, bob: number) => {
    expect((await w.run.read(viewOf, 'alice')).position.scores).toEqual([
      alice,
      bob,
    ]);
  }
);
Then('{actor} wins', async (w, actor: string) => {
  const scores = (await w.run.read(viewOf, actor)).position.scores;
  const seat = SEATS.indexOf(actor);
  expect(
    scores.every((score, at) => at === seat || score < (scores[seat] ?? 0))
  ).toBe(true);
});
Then('Alice and Bob share the win', async (w) => {
  const [alice, bob] = (await w.run.read(viewOf, 'alice')).position.scores;
  expect(alice).toBe(bob ?? Number.NaN);
});
Then('the game has no scoreless turns in a row', async (w) => {
  expect((await w.run.read(viewOf, 'alice')).position.scoreless).toBe(0);
});
Then('Bob sees that Alice holds seven tiles', async (w) => {
  expect((await w.run.read(viewOf, 'bob')).position.racks[0]).toBe(7);
});
Then("Bob sees none of Alice's tiles", async (w) => {
  const bob = await w.run.read(viewOf, 'bob');
  const alice = (await w.run.read(viewOf, 'alice')).rack;
  expect(bob.rack.some((id) => alice.includes(id))).toBe(false);
  expect(JSON.stringify(bob.position)).not.toContain(alice.join(','));
});
Then('the challenge is solved with {int} points', async (w, points: number) => {
  expect([
    await w.run.read(challengeSolved),
    (await w.run.read(lastScore))?.score,
  ]).toEqual([true, points]);
});
Then('the challenge is still unsolved', async (w) => {
  expect(await w.run.read(challengeSolved)).toBe(false);
});
Then('the challenge is published', async (w) => {
  expect(await w.run.read(challengePublished)).toBe(true);
});
Then('the challenge is still not published', async (w) => {
  expect(await w.run.read(challengePublished)).toBe(false);
});
