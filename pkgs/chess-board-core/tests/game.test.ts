import { describe, expect, test } from 'bun:test';
import { ChessGame } from '@pkgs/chess-board-core/game';
import { indexFromSquare } from '@pkgs/chess-board-core/geometry';
import {
  applyUci,
  boardOrientationFromFen,
  uciFromMove,
} from '@pkgs/chess-board-core/uci';
import { parseUci } from '@pkgs/chess-rules/uci';
import { Chess } from 'chess.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('ChessGame', () => {
  test('initial snapshot mirrors the start position', () => {
    const game = new ChessGame();
    const s = game.getSnapshot();
    expect(s.fen).toBe(START_FEN);
    expect(s.turn).toBe('w');
    expect(s.lastMove).toBeNull();
    expect(s.position[indexFromSquare('e1')]).toEqual({
      color: 'w',
      type: 'k',
    });
    expect(s.position[indexFromSquare('e4')]).toBeNull();
    expect(s.isGameOver).toBe(false);
  });

  test('tryMove publishes a new snapshot with lastMove and notifies', () => {
    const game = new ChessGame();
    let notified = 0;
    const unsub = game.subscribe(() => {
      notified += 1;
    });
    const before = game.getSnapshot();
    const r = game.tryMove({ from: 'e2', to: 'e4' });
    expect(r.ok).toBe(true);
    const after = game.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.lastMove?.from).toBe('e2');
    expect(after.lastMove?.san).toBe('e4');
    expect(after.turn).toBe('b');
    expect(notified).toBe(1);
    unsub();
    game.tryMove({ from: 'e7', to: 'e5' });
    expect(notified).toBe(1);
  });

  test('illegal move is rejected without changing state', () => {
    const game = new ChessGame();
    const before = game.getSnapshot();
    expect(game.tryMove({ from: 'e2', to: 'e5' })).toEqual({ ok: false });
    expect(game.getSnapshot()).toBe(before);
  });

  test('legalMovesFrom dedupes promotion targets', () => {
    const game = new ChessGame('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect([...game.legalMovesFrom('a7')]).toEqual(['a8']);
    expect(game.moveRequiresPromotion('a7', 'a8')).toBe(true);
    expect(game.moveRequiresPromotion('a1', 'a2')).toBe(false);
    const r = game.tryMove({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(r.ok && r.move.promotion).toBe('q');
  });

  test('castling reports the rook leg', () => {
    const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const r = game.tryMove({ from: 'e1', to: 'g1' });
    expect(r.ok && r.move.castle).toEqual({ rookFrom: 'h1', rookTo: 'f1' });
  });

  test('checkmate flags', () => {
    const game = new ChessGame(
      'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
    );
    const r = game.tryMove({ from: 'h5', to: 'f7' });
    expect(r.ok && r.isCheckmate).toBe(true);
    expect(game.getSnapshot().isCheckmate).toBe(true);
    expect(game.getSnapshot().isGameOver).toBe(true);
  });

  test('applyExternalFen infers the single ply and is a no-op on same FEN', () => {
    const game = new ChessGame();
    const other = new Chess();
    other.move('e4');
    const res = game.applyExternalFen(other.fen());
    expect(res?.moved).toMatchObject({ from: 'e2', to: 'e4' });
    expect(game.getSnapshot().lastMove).toMatchObject({ from: 'e2', to: 'e4' });
    expect(game.applyExternalFen(other.fen())).toBeNull();
  });

  test('a malformed FEN never throws: start position / position kept', () => {
    expect(new ChessGame('not a fen').getSnapshot().fen).toBe(
      new Chess().fen()
    );
    const game = new ChessGame();
    game.tryMove({ from: 'e2', to: 'e4' });
    const fen = game.getSnapshot().fen;
    expect(game.applyExternalFen('8/8/8 w - - 0 1')).toBeNull();
    expect(game.getSnapshot().fen).toBe(fen);
  });

  test('reset / undo / pgn round-trip', () => {
    const game = new ChessGame();
    game.tryMove({ from: 'e2', to: 'e4' });
    game.tryMove({ from: 'e7', to: 'e5' });
    const pgn = game.pgn();
    expect(game.undo()).toBe(true);
    expect(game.getSnapshot().lastMove).toBeNull();
    game.reset();
    expect(game.getSnapshot().fen).toBe(START_FEN);
    expect(game.loadPgn(pgn)).toBe(true);
    expect(game.getSnapshot().turn).toBe('w');
    expect(game.loadPgn('1. zz')).toBe(false);
  });
});

describe('uci', () => {
  test('uciFromMove / parseUci', () => {
    expect(uciFromMove({ from: 'e2', to: 'e4' })).toBe('e2e4');
    expect(uciFromMove({ from: 'a7', to: 'a8', promotion: 'n' })).toBe('a7a8n');
    expect(parseUci('E7E8Q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    // Strict since the rules kernel (§1): a bad promotion char is malformed.
    expect(parseUci('e2e4x')).toBeNull();
    expect(parseUci('e2')).toBeNull();
  });

  test('boardOrientationFromFen', () => {
    expect(boardOrientationFromFen(START_FEN)).toBe('white');
    expect(boardOrientationFromFen('8/8/8/8/8/8/8/8 b - - 0 1')).toBe('black');
    expect(boardOrientationFromFen('garbage')).toBe('white');
  });

  test('applyUci applies legal moves and rejects illegal ones', () => {
    const chess = new Chess();
    expect(applyUci(chess, 'e2e4')).toBe(true);
    expect(applyUci(chess, 'e2e4')).toBe(false);
    expect(applyUci(chess, 'e7')).toBe(false);
  });
});
