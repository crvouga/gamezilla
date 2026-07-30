/**
 * Project chess puzzle-play room events into collaborative log lines.
 */

import type { LogLineContext, LogLineDraft } from '@pkgs/collab';
import { asLocalized } from '@pkgs/i18n';
import { createMessageRouter, type MessageRouter } from '@pkgs/message';

import { CHESS_PUZZLE_PLAY_STATUS } from './chess-puzzle-play-attr';
import {
  ChessPuzzleHostReclaimed,
  ChessPuzzleHintRevealed,
  ChessPuzzlePlayCleared,
  ChessPuzzlePlayMoveAccepted,
  ChessPuzzlePlayMoveRejected,
  ChessPuzzlePlayResetEvt,
  ChessPuzzlePlayStarted,
  ChessPuzzlePlayStepped,
  ChessPuzzleSolutionRevealed,
  chessPuzzlePlayEvtNs,
} from './chess-puzzle-play-messages';

export const CHESS_LOG_TARGET = {
  puzzle: 'chess/puzzle',
  board: 'chess/puzzle/board',
} as const;

export type ChessPuzzlePlayDescribeRouter = MessageRouter<
  void,
  LogLineContext,
  LogLineDraft | null
>;

export const chessPuzzlePlayDescribeRouter: ChessPuzzlePlayDescribeRouter =
  createMessageRouter<void, LogLineContext, LogLineDraft | null>(
    chessPuzzlePlayEvtNs
  )
    .on(ChessPuzzlePlayStarted, (_s, _ctx, msg) => {
      if (msg.payload.status === CHESS_PUZZLE_PLAY_STATUS.invalid) {
        return {
          text: asLocalized('started an invalid puzzle'),
          icon: 'play',
          targetKeys: [CHESS_LOG_TARGET.puzzle],
        };
      }
      return {
        text: asLocalized('started a puzzle'),
        icon: 'play',
        targetKeys: [CHESS_LOG_TARGET.puzzle],
      };
    })
    .on(ChessPuzzlePlayMoveAccepted, (_s, _ctx, msg) => {
      const { san, status } = msg.payload;
      if (status === CHESS_PUZZLE_PLAY_STATUS.solved) {
        return {
          text: asLocalized(`played ${san} · puzzle solved`),
          icon: 'circle-check',
          targetKeys: [CHESS_LOG_TARGET.board, CHESS_LOG_TARGET.puzzle],
        };
      }
      return {
        text: asLocalized(`played ${san}`),
        icon: 'play',
        targetKeys: [CHESS_LOG_TARGET.board],
      };
    })
    .on(ChessPuzzlePlayMoveRejected, (_s, _ctx, msg) => ({
      text: asLocalized(`played wrong move ${msg.payload.san}`),
      icon: 'x',
      targetKeys: [CHESS_LOG_TARGET.board],
    }))
    .on(ChessPuzzlePlayResetEvt, () => ({
      text: asLocalized('reset the puzzle'),
      icon: 'rotate-ccw',
      targetKeys: [CHESS_LOG_TARGET.board],
    }))
    .on(ChessPuzzleHintRevealed, () => ({
      text: asLocalized('requested a hint'),
      icon: 'lightbulb',
      targetKeys: [CHESS_LOG_TARGET.board],
    }))
    .on(ChessPuzzleSolutionRevealed, () => ({
      text: asLocalized('revealed the solution'),
      icon: 'list-checks',
      targetKeys: [CHESS_LOG_TARGET.board],
    }))
    .on(ChessPuzzlePlayCleared, () => ({
      text: asLocalized('ended the puzzle'),
      icon: 'door-open',
      targetKeys: [CHESS_LOG_TARGET.puzzle],
    }))
    .on(ChessPuzzleHostReclaimed, () => ({
      text: asLocalized('took over the puzzle'),
      icon: 'user',
      targetKeys: [CHESS_LOG_TARGET.puzzle],
    }))
    .on(ChessPuzzlePlayStepped, () => null);
