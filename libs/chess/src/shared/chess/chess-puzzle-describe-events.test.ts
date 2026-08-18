import { describe, expect, it } from 'bun:test';
import { projectEventLog } from '@pkgs/collab';
import {
  CHESS_LOG_TARGET,
  chessPuzzlePlayDescribeRouter,
} from './chess-puzzle-describe-events';
import { CHESS_PUZZLE_PLAY_STATUS } from './chess-puzzle-play-attr';
import {
  ChessPuzzleHintRevealed,
  ChessPuzzlePlayCleared,
  ChessPuzzlePlayMoveAccepted,
  ChessPuzzlePlayMoveRejected,
  ChessPuzzlePlayStarted,
  ChessPuzzlePlayStepped,
} from './chess-puzzle-play-messages';

const actor = { id: 'host-1', clientId: 'c1' };

describe('chessPuzzlePlayDescribeRouter', () => {
  it('describes started / accepted / rejected / hint / cleared', () => {
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: ChessPuzzlePlayStarted({
            puzzleId: 'p1',
            fen: '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1',
            moves: 'e8d7 e1f2',
            hostIdentity: 'host-1',
            displayFen: '4k3/8/8/8/8/8/4P3/4K2R w - - 1 1',
            orientation: 'white',
            status: CHESS_PUZZLE_PLAY_STATUS.solving,
            solveIdx: 1,
          }),
          actor,
          ts: 10,
        },
        {
          seq: 2,
          event: ChessPuzzlePlayMoveAccepted({
            uci: 'e1f2',
            san: 'Kf2',
            displayFen: 'fen-after',
            solveIdx: 2,
            status: CHESS_PUZZLE_PLAY_STATUS.solving,
          }),
          actor,
          ts: 20,
        },
        {
          seq: 3,
          event: ChessPuzzlePlayMoveAccepted({
            uci: 'f2e3',
            san: 'Ke3',
            displayFen: 'fen-solved',
            solveIdx: 4,
            status: CHESS_PUZZLE_PLAY_STATUS.solved,
          }),
          actor,
          ts: 30,
        },
        {
          seq: 4,
          event: ChessPuzzlePlayMoveRejected({
            uci: 'h1h2',
            san: 'Rh2',
            layoutKey: 1,
            wrongFromSquare: 'h1',
            wrongToSquare: 'h2',
            displayFen: 'fen-wrong',
            previousDisplayFen: 'fen-prev',
          }),
          actor,
          ts: 40,
        },
        {
          seq: 5,
          event: ChessPuzzleHintRevealed({
            fromSquare: 'e1',
            toSquare: 'f2',
            layoutKey: 2,
          }),
          actor,
          ts: 50,
        },
        {
          seq: 6,
          event: ChessPuzzlePlayCleared({}),
          actor,
          ts: 60,
        },
      ],
      chessPuzzlePlayDescribeRouter
    );

    expect(lines.map((l) => String(l.text))).toEqual([
      'started a puzzle',
      'played Kf2',
      'played Ke3 · puzzle solved',
      'played wrong move Rh2',
      'requested a hint',
      'ended the puzzle',
    ]);
    expect(lines[0]?.icon).toBe('play');
    expect(lines[2]?.icon).toBe('circle-check');
    expect(lines[3]?.icon).toBe('x');
    expect(lines[0]?.targetKeys).toEqual([CHESS_LOG_TARGET.puzzle]);
  });

  it('describes invalid start without puzzle id', () => {
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: ChessPuzzlePlayStarted({
            puzzleId: 'opaque-id',
            fen: 'bad',
            moves: 'bad',
            hostIdentity: 'host-1',
            displayFen: null,
            orientation: 'white',
            status: CHESS_PUZZLE_PLAY_STATUS.invalid,
            solveIdx: 0,
          }),
          actor,
          ts: 10,
        },
      ],
      chessPuzzlePlayDescribeRouter
    );
    expect(lines).toHaveLength(1);
    expect(String(lines[0]?.text)).toBe('started an invalid puzzle');
    expect(String(lines[0]?.text)).not.toContain('opaque-id');
  });

  it('omits stepped events', () => {
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: ChessPuzzlePlayStepped({
            displayFen: 'fen',
            solveIdx: 1,
            status: CHESS_PUZZLE_PLAY_STATUS.solving,
            layoutKey: 1,
          }),
          actor,
          ts: 10,
        },
      ],
      chessPuzzlePlayDescribeRouter
    );
    expect(lines).toHaveLength(0);
  });
});
