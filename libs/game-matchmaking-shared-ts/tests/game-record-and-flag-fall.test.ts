/**
 * What the framework owns around a game's own answers: when a matched
 * game's record is asked of the game (`history.record`), with what, and
 * how a flag fall reads the game's `canWin`. The game here is a stub whose
 * answers are fixed, so only the framework is under test.
 */
import { describe, expect, test } from 'bun:test';
import { gameRecord } from '@libs/game-matchmaking-shared-ts/game-record';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { settleMultiplayerClock } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import type {
  GameRecordMetadata,
  GameRules,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

const asked: {
  position: string;
  history: string;
  metadata: GameRecordMetadata;
}[] = [];

const rules: GameRules = {
  id: 'stub',
  recognizes: (position) => position.startsWith('stub:'),
  initial: () => 'stub:start',
  play: () => null,
  replay: () => 'stub:start',
  legal: () => [],
  // A position naming a side's bare king: that side cannot win.
  canWin: (position, side) => !position.includes(`bare-${side}`),
  moves: () => [],
};

const GAMES = createTurnGames([
  {
    rules,
    capabilities: {
      matchmaking: {
        clockNamespace: 'stub/',
        notice: {
          timeoutDraw: () => '',
          side: () => '',
          ending: () => undefined,
        },
      },
      history: {
        record: (position, history, metadata) => {
          asked.push({ position, history, metadata });
          return 'the record';
        },
      },
    },
  },
]);

function stored(patch: Partial<MultiplayerGame> = {}): MultiplayerGame {
  return {
    id: 'game-1',
    white_id: 'white-user',
    black_id: 'black-user',
    fen: 'stub:after',
    pgn: 'stub history',
    revision: 2,
    turn: 'white-user',
    outcome: 'white',
    reason: 'resignation',
    time_control: 'stub/5+0',
    white_ms: 1_000,
    black_ms: 30_000,
    clock_at_ms: 0,
    paused_at_ms: null,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: '1500?',
    black_rating: null,
    white_rating_diff: null,
    black_rating_diff: null,
    setup_ready: null,
    ...patch,
  };
}

const NAMES = { white: 'alice', black: 'bob' };

describe("a matched game's record", () => {
  test.each(['ongoing', 'aborted'] as const)(
    'an %s game has none, and the game is never asked',
    (outcome) => {
      asked.length = 0;
      expect(gameRecord(stored({ outcome }), NAMES, GAMES)).toBeNull();
      expect(asked).toEqual([]);
    }
  );

  test('a finished game asks the game once, with both people, the result and the clock choice', () => {
    asked.length = 0;
    expect(
      gameRecord(stored({ outcome: 'draw', reason: 'agreement' }), NAMES, GAMES)
    ).toBe('the record');
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      position: 'stub:after',
      history: 'stub history',
      metadata: {
        participants: [
          { name: 'alice', rating: '1500?' },
          { name: 'bob', rating: null },
        ],
        outcome: 'draw',
        reason: 'agreement',
        timeControl: { minutes: 5, incrementSeconds: 0, daysPerMove: 0 },
      },
    });
  });

  test.each([
    ['stub/2+1', { minutes: 2, incrementSeconds: 1, daysPerMove: 0 }],
    ['stub/3d', { minutes: 3 * 24 * 60, incrementSeconds: 0, daysPerMove: 3 }],
    [null, null],
  ] as const)(
    'the clock choice %s is described to the game as %o',
    (control, described) => {
      asked.length = 0;
      gameRecord(stored({ time_control: control }), NAMES, GAMES);
      if (described === null) expect(asked[0]?.metadata.timeControl).toBeNull();
      else expect(asked[0]?.metadata.timeControl).toMatchObject(described);
    }
  );
});

describe('a flag fall', () => {
  const due = (fen: string) =>
    stored({ fen, outcome: 'ongoing', reason: null, time_control: 'stub/1+0' });

  test('loses for the side to move when the other side can still win', () => {
    expect(
      settleMultiplayerClock(due('stub:middlegame'), 1_000, GAMES)
    ).toMatchObject({
      outcome: 'black',
      reason: 'timeout',
      white_ms: 0,
    });
  });

  test('draws when the other side cannot win by the game rules', () => {
    expect(
      settleMultiplayerClock(due('stub:bare-black'), 1_000, GAMES)
    ).toMatchObject({
      outcome: 'draw',
      reason: 'timeout vs insufficient material',
      white_ms: 0,
    });
  });

  test('changes nothing while time is left', () => {
    const game = due('stub:bare-black');
    expect(settleMultiplayerClock(game, 999, GAMES)).toBe(game);
  });
});
