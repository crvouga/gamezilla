/**
 * The shared laws of what a game's screens and records say: a faulty copy
 * of the reference game losing its side names or ending descriptions,
 * giving its frame an empty turn line or a result out of step with the
 * winner, or writing a game record with the wrong people, result or game,
 * is refused by the law it breaks — and only that law — for the reason it
 * names.
 */

import { expect, test } from 'bun:test';
import type {
  ReadGameRecord,
  TurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import type {
  GameRecordMetadata,
  HistoryCapability,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  COUNTING_RACE_CLIENT,
  COUNTING_RACE_RULES,
  COUNTING_RACE_TURN_GAME,
} from './counting-race-game';
import { definedWith, lawNames, refusals } from './faulty-game';

function expectRefusedBy(game: TurnHarnessGame, law: string, reason: string) {
  const refused = refusals(game);
  expect([...refused.keys()]).toEqual([law]);
  expect(refused.get(law)).toContain(reason);
}

const PRESENTATION = COUNTING_RACE_CLIENT.presentation;
const FRAME = PRESENTATION.frame;

test('a game whose ending has no description is refused', () => {
  const silent = definedWith(
    {},
    { presentation: { ...PRESENTATION, endingDescription: () => undefined } }
  );
  expectRefusedBy(
    silent,
    'every ending its rules reach is described and labelled',
    'the ending "finish line" has no description'
  );
});

test('a game describing a reason it never gives is refused', () => {
  // regression: game-session-ending-descriptions-lost
  const generic = definedWith(
    {},
    { presentation: { ...PRESENTATION, endingDescription: () => 'Game over.' } }
  );
  expectRefusedBy(
    generic,
    'a reason the game never gives has no description',
    'is described as "Game over."'
  );
});

test('a game whose sides share one name is refused', () => {
  const nameless = definedWith(
    {},
    { presentation: { ...PRESENTATION, sideLabel: () => 'Runner' } }
  );
  expectRefusedBy(
    nameless,
    'the game and each of its sides have a name of their own',
    'seated sides share a name'
  );
});

test('a game whose draw on time is not described is refused', () => {
  const unexplained = definedWith(
    {},
    { presentation: { ...PRESENTATION, timeoutDrawDescription: () => '' } }
  );
  expectRefusedBy(
    unexplained,
    'a draw on time is described whichever side ran out',
    'a draw on time against the first side has no description'
  );
});

/**
 * The reference game's record when it also finds opponents: JSON naming
 * the people, the result, the clock choice and every move, as `read`
 * reads it back without the game's code.
 */
type RaceRecord = {
  readonly first: string;
  readonly second: string;
  readonly result: string;
  readonly clock: string | null;
  readonly moves: readonly string[];
};

const clockOf = (metadata: GameRecordMetadata): string | null => {
  const clock = metadata.timeControl;
  if (clock === null) return null;
  return clock.daysPerMove > 0
    ? `${String(clock.daysPerMove)}d`
    : `${String(clock.minutes)}+${String(clock.incrementSeconds)}`;
};

const soundRecord: HistoryCapability['record'] = (
  position,
  history,
  metadata
) =>
  JSON.stringify({
    first: metadata.participants[0]!.name,
    second: metadata.participants[1]!.name,
    // The counting race always names one winner or a draw.
    result: String(metadata.outcome),
    clock: clockOf(metadata),
    moves: COUNTING_RACE_RULES.moves(position, history, []).map(
      (move) => move.label
    ),
  } satisfies RaceRecord);

function read(record: string): ReadGameRecord {
  const parsed = JSON.parse(record) as RaceRecord;
  return {
    firstSide: parsed.first,
    secondSide: parsed.second,
    result:
      parsed.result === 'white' ||
      parsed.result === 'black' ||
      parsed.result === 'draw'
        ? parsed.result
        : null,
    clockChoice: parsed.clock,
    moves: parsed.moves,
  };
}

const notice = {
  timeoutDraw: () => 'Drawn on time.',
  side: (side: string) => (side === 'white' ? 'Hare' : 'Tortoise'),
  ending: () => undefined,
};

/** The reference game finding opponents, its matched games recorded by `record`. */
function matched(record: HistoryCapability['record']): TurnHarnessGame {
  return definedWith(
    {
      capabilities: {
        ...COUNTING_RACE_TURN_GAME.capabilities,
        matchmaking: {
          clockChoices: true as const,
          namespace: 'counting-race/',
          notice,
        },
        history: { record },
      },
    },
    {},
    { readRecord: read }
  );
}

const RECORD_LAW =
  'the game record names both people, the result, the clock choice and every move of this game';

test('a frame whose turn line is empty is refused', () => {
  const blank = definedWith(
    {},
    {
      presentation: {
        ...PRESENTATION,
        frame: { ...FRAME, turnStatus: () => ' ' },
      },
    }
  );
  expectRefusedBy(
    blank,
    'the frame tells each seat and the turn in every position',
    'the turn line for null is empty'
  );
});

test('a frame whose result puts the loser first is refused', () => {
  const backwards = definedWith(
    {},
    {
      presentation: {
        ...PRESENTATION,
        frame: {
          ...FRAME,
          result: () => ({
            scoreLabel: null,
            standings: [
              { side: 'white', place: 2, score: null },
              { side: 'black', place: 1, score: null },
            ],
          }),
        },
      },
    }
  );
  expectRefusedBy(
    backwards,
    'a finished game lists each seat once, its winners first',
    'the white seat is placed 2 in a game won by white'
  );
});

test('a sound record keeps every law, and the record law binds it', () => {
  const game = matched(soundRecord);
  expect(lawNames(game)).toContain(RECORD_LAW);
  expect([...refusals(game).keys()]).toEqual([]);
});

test('a record naming the people on the wrong sides is refused', () => {
  const swapped = matched((position, history, metadata) =>
    soundRecord(position, history, {
      ...metadata,
      participants: [metadata.participants[1]!, metadata.participants[0]!],
    })
  );
  expectRefusedBy(swapped, RECORD_LAW, 'the record names');
});

test('a record giving the wrong result is refused', () => {
  const victorious = matched((position, history, metadata) =>
    soundRecord(position, history, { ...metadata, outcome: 'white' })
  );
  expectRefusedBy(victorious, RECORD_LAW, 'the record gives white, not');
});

test('a record of a game other than the one played is refused', () => {
  // Every record is of one finished race, whatever was played.
  const another = matched((_position, _history, metadata) =>
    soundRecord('race:7b', '', metadata)
  );
  expectRefusedBy(another, RECORD_LAW, "are not this game's");
});
