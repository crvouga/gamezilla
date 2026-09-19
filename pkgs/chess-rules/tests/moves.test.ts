import { describe, expect, test } from 'bun:test';
import {
  applyUci,
  castlingFromRookInput,
  castlingRookTargets,
  legalMoves,
  positionStatus,
  sanFromUci,
  uciFromSan,
} from '@pkgs/chess-rules/moves';
import { Chess } from 'chess.js';

function legal(fen: string, uci: string): boolean {
  return applyUci(fen, uci).ok;
}

function played(fen: string, uci: string): string {
  const result = applyUci(fen, uci);
  if (!result.ok) throw new Error(`${uci} rejected: ${result.reason}`);
  return result.fen;
}

describe('castling', () => {
  const bothSides = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

  test('both sides, SAN O-O / O-O-O', () => {
    expect(sanFromUci(bothSides, 'e1g1')).toBe('O-O');
    expect(sanFromUci(bothSides, 'e1c1')).toBe('O-O-O');
    expect(uciFromSan(bothSides, 'O-O-O')).toBe('e1c1');
  });

  test('king onto own rook is accepted and normalized', () => {
    const kingside = applyUci(bothSides, 'e1h1');
    const queenside = applyUci(bothSides, 'e1a1');
    expect(kingside.ok && kingside.uci).toBe('e1g1');
    expect(queenside.ok && queenside.uci).toBe('e1c1');
    expect(applyUci(played(bothSides, 'a1b1'), 'e8h8').ok).toBe(true);
  });

  test('board input helpers: rook targets and the castle they stand for', () => {
    const chess = new Chess(bothSides);
    expect([...castlingRookTargets(chess, 'e1')].sort()).toEqual(['a1', 'h1']);
    expect(castlingRookTargets(chess, 'a1')).toEqual([]);
    expect(castlingFromRookInput(chess, { from: 'e1', to: 'h1' })).toEqual({
      from: 'e1',
      to: 'g1',
    });
    expect(castlingFromRookInput(chess, { from: 'e1', to: 'a1' })).toEqual({
      from: 'e1',
      to: 'c1',
    });
    expect(castlingFromRookInput(chess, { from: 'e1', to: 'f1' })).toBeNull();
    const noRights = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1');
    expect(castlingRookTargets(noRights, 'e1')).toEqual([]);
    expect(
      castlingFromRookInput(noRights, { from: 'e1', to: 'h1' })
    ).toBeNull();
    const black = new Chess('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    expect([...castlingRookTargets(black, 'e8')].sort()).toEqual(['a8', 'h8']);
  });

  test('rights are tracked', () => {
    const noRights = 'r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1';
    expect(legal(noRights, 'e1g1')).toBe(false);
    expect(legal(noRights, 'e1h1')).toBe(false);
    const afterRookMove = played(played(bothSides, 'h1h2'), 'e8e7');
    expect(legal(afterRookMove, 'e1g1')).toBe(false);
    expect(legal(afterRookMove, 'e1c1')).toBe(true);
  });

  test('not out of, through, or into check; attacked rook is fine', () => {
    expect(legal('r3k2r/8/8/8/4r3/8/8/R3K2R w KQ - 0 1', 'e1g1')).toBe(false);
    expect(legal('r3k2r/8/8/8/4r3/8/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(false);
    expect(legal('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1')).toBe(false);
    expect(legal('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(true);
    expect(legal('4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1')).toBe(false);
    expect(legal('4k2r/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1')).toBe(true);
    expect(legal('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(true);
  });
});

describe('en passant', () => {
  test('capture square, only on the immediately following move', () => {
    const before = '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1';
    const afterDoublePush = played(before, 'd7d5');
    const capture = applyUci(afterDoublePush, 'e5d6');
    expect(capture.ok && capture.san).toBe('exd6');
    expect(capture.ok && capture.fen.startsWith('4k3/8/3P4/8/')).toBe(true);
    const later = played(played(afterDoublePush, 'e1e2'), 'e8e7');
    expect(legal(later, 'e5d6')).toBe(false);
  });

  test('illegal when it exposes the own king along the rank', () => {
    const pinned = '8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1';
    expect(legal(pinned, 'e5d6')).toBe(false);
    expect(legalMoves(pinned).some((m) => m.isEnPassant)).toBe(false);
  });
});

describe('promotion', () => {
  test('to every piece; missing suffix is illegal', () => {
    const fen = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
    for (const piece of ['q', 'r', 'b', 'n'])
      expect(legal(fen, `a7a8${piece}`)).toBe(true);
    expect(legal(fen, 'a7a8')).toBe(false);
    // A promotion suffix on a non-promoting move is rejected, not ignored.
    expect(legal(fen, 'a1b1q')).toBe(false);
    expect(sanFromUci(fen, 'a7a8q')).toBe('a8=Q');
  });

  test('capture-promotion and underpromotion SAN', () => {
    const fen = '1n5k/P7/8/8/8/8/8/K7 w - - 0 1';
    expect(sanFromUci(fen, 'a7b8q')).toBe('axb8=Q+');
    expect(sanFromUci(fen, 'a7b8n')).toBe('axb8=N');
    expect(uciFromSan(fen, 'axb8=R')).toBe('a7b8r');
  });
});

describe('check, mate, stalemate, pins', () => {
  test('checkmate and mate SAN', () => {
    expect(
      positionStatus(
        'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
      )
    ).toEqual({
      isCheck: true,
      isCheckmate: true,
      isStalemate: false,
    });
    const mate = applyUci('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8');
    expect(mate.ok && mate.san).toBe('Ra8#');
    expect(mate.ok && mate.isCheckmate).toBe(true);
  });

  test('stalemate', () => {
    expect(positionStatus('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toEqual({
      isCheck: false,
      isCheckmate: false,
      isStalemate: true,
    });
  });

  test('pinned piece cannot move; discovered check is detected', () => {
    expect(
      legalMoves('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1').some(
        (m) => m.from === 'e2'
      )
    ).toBe(false);
    const discovered = applyUci('4k3/8/8/8/8/8/4N3/4R1K1 w - - 0 1', 'e2c3');
    expect(discovered.ok && discovered.san).toBe('Nc3+');
    expect(discovered.ok && discovered.isCheck).toBe(true);
  });
});

describe('SAN disambiguation', () => {
  test('file, rank and full-square disambiguation', () => {
    expect(sanFromUci('rn2k3/8/5n2/8/8/8/8/4K3 b - - 0 1', 'b8d7')).toBe(
      'Nbd7'
    );
    expect(sanFromUci('k7/8/8/8/8/4R3/8/4R1K1 w - - 0 1', 'e1e2')).toBe('R1e2');
    expect(sanFromUci('8/8/1k6/8/4Q2Q/2K5/8/7Q w - - 0 1', 'h4e1')).toBe(
      'Qh4e1'
    );
    expect(uciFromSan('8/8/1k6/8/4Q2Q/2K5/8/7Q w - - 0 1', 'Qh4e1')).toBe(
      'h4e1'
    );
  });

  test('rejections carry a reason', () => {
    expect(applyUci('bad fen', 'e2e4')).toEqual({
      ok: false,
      reason: 'invalidFen',
    });
    expect(applyUci('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'zz')).toEqual({
      ok: false,
      reason: 'malformedUci',
    });
    expect(applyUci('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'e2e5')).toEqual({
      ok: false,
      reason: 'illegal',
    });
    expect(uciFromSan('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'Nf3')).toBeNull();
  });
});
