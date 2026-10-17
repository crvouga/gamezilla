import { describe, expect, test } from 'bun:test';
import { chessTurnGame } from '@libs/chess-sub-shared/chess-game';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { settleMultiplayerClock } from '@libs/game-matchmaking-shared/multiplayer-clock';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

const TURN_GAMES = createTurnGames([chessTurnGame]);

/** White to move in a live 1+0 game, both have moved, one second left. */
function whiteAboutToFlag(fen: string): MultiplayerGame {
  return {
    id: 'game-1',
    white_id: 'white-user',
    black_id: 'black-user',
    fen,
    pgn: '',
    revision: 2,
    turn: 'white-user',
    outcome: 'ongoing',
    reason: null,
    time_control: '1+0',
    white_ms: 1_000,
    black_ms: 30_000,
    clock_at_ms: 0,
    paused_at_ms: null,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: null,
    black_rating: null,
    white_rating_diff: null,
    black_rating_diff: null,
  };
}

function settled(fen: string): Pick<MultiplayerGame, 'outcome' | 'reason'> {
  const game = settleMultiplayerClock(whiteAboutToFlag(fen), 1_000, TURN_GAMES);
  return { outcome: game.outcome, reason: game.reason };
}

const DRAWN = {
  outcome: 'draw',
  reason: 'timeout vs insufficient material',
} as const;
const BLACK_WINS = { outcome: 'black', reason: 'timeout' } as const;

describe('running out of time against material that cannot checkmate', () => {
  // regression: chess-timeout-lone-knight-vs-queens
  test('a lone knight cannot mate a king whose only helpers are queens', () => {
    expect(settled('4k3/8/8/8/8/2n5/8/Q3K3 w - - 0 60')).toEqual(DRAWN);
    expect(settled('4k3/8/8/8/8/2n5/8/QQ2K3 w - - 0 60')).toEqual(DRAWN);
  });

  // regression: chess-timeout-lone-bishop-vs-major-piece
  test('a lone bishop cannot mate a king whose only helpers are rooks or queens', () => {
    expect(settled('4k3/8/8/8/8/1b6/8/R3K3 w - - 0 60')).toEqual(DRAWN);
    expect(settled('4k3/8/8/8/8/1b6/8/Q3K3 w - - 0 60')).toEqual(DRAWN);
  });

  test('a bare king draws', () => {
    expect(settled('4k3/8/8/8/8/8/8/Q3K3 w - - 0 60')).toEqual(DRAWN);
  });
});

describe('running out of time against material that can still checkmate', () => {
  test('a knight wins on time when a rook, bishop, knight or pawn can block', () => {
    expect(settled('4k3/8/8/8/8/2n5/8/R3K3 w - - 0 60')).toEqual(BLACK_WINS);
    expect(settled('4k3/8/8/8/8/2n5/8/B3K3 w - - 0 60')).toEqual(BLACK_WINS);
    expect(settled('4k3/8/8/8/8/2n5/8/N3K3 w - - 0 60')).toEqual(BLACK_WINS);
    expect(settled('4k3/8/8/8/8/2n5/P7/4K3 w - - 0 60')).toEqual(BLACK_WINS);
  });

  test('a bishop wins on time against a knight, a pawn or an opposite bishop', () => {
    expect(settled('4k3/8/8/8/8/1b6/8/N3K3 w - - 0 60')).toEqual(BLACK_WINS);
    expect(settled('4k3/8/8/8/8/1b6/P7/4K3 w - - 0 60')).toEqual(BLACK_WINS);
    expect(settled('4k3/8/8/8/8/1b6/8/B3K3 w - - 0 60')).toEqual(BLACK_WINS);
  });

  test('a pawn, rook or queen always wins on time', () => {
    expect(settled('4k3/7p/8/8/8/8/8/Q3K3 w - - 0 60')).toEqual(BLACK_WINS);
    expect(settled('r3k3/8/8/8/8/8/8/4K3 w - - 0 60')).toEqual(BLACK_WINS);
  });

  test('time left changes nothing', () => {
    const game = whiteAboutToFlag('4k3/8/8/8/8/2n5/8/Q3K3 w - - 0 60');
    expect(settleMultiplayerClock(game, 999, TURN_GAMES)).toBe(game);
  });
});
