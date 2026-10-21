import { describe, expect, test } from 'bun:test';
import { parseFen } from '@pkgs/chess-rules-shared-ts/fen';
import {
  applyUci,
  castlingFromRookInput,
  castlingRookTargets,
  legalMoves,
  playUci,
  positionStatus,
  sanFromUci,
  uciFromSan,
} from '@pkgs/chess-rules-shared-ts/moves';
import { Chess } from 'chess.js';

function legal(fen: string, uci: string): boolean {
  return applyUci(fen, uci).ok;
}

function played(fen: string, uci: string): string {
  const result = applyUci(fen, uci);
  if (!result.ok) throw new Error(`${uci} rejected: ${result.reason}`);
  return result.fen;
}

function playedAll(fen: string, ucis: readonly string[]): string {
  return ucis.reduce(played, fen);
}

function castlingRights(fen: string): string {
  const parsed = parseFen(fen);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.fields.castling;
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

describe('castling: attacked squares, both wings and both colours', () => {
  test('queenside: not through d1 nor into c1; the rook may cross b1 or stand attacked', () => {
    expect(legal('3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(false);
    expect(legal('3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1')).toBe(true);
    expect(legal('2r1k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(false);
    expect(legal('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1a1')).toBe(true);
    expect(legal('r3k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(true);
  });

  test('black: not out of, through, or into check; the rook may cross b8', () => {
    expect(legal('r3k2r/8/8/8/8/8/8/4R1K1 b kq - 0 1', 'e8g8')).toBe(false);
    expect(legal('r3k2r/8/8/8/8/8/8/4R1K1 b kq - 0 1', 'e8c8')).toBe(false);
    expect(legal('r3k2r/8/8/8/8/8/8/5RK1 b kq - 0 1', 'e8g8')).toBe(false);
    expect(legal('r3k2r/8/8/8/8/8/8/3R2K1 b kq - 0 1', 'e8c8')).toBe(false);
    expect(legal('r3k2r/8/8/8/8/8/8/2R3K1 b kq - 0 1', 'e8c8')).toBe(false);
    expect(legal('r3k2r/8/8/8/8/8/8/1R4K1 b kq - 0 1', 'e8c8')).toBe(true);
  });

  test('a knight or pawn guarding the crossing square refuses it too', () => {
    expect(legal('4k3/8/8/8/8/4n3/8/R3K2R w KQ - 0 1', 'e1g1')).toBe(false);
    expect(legal('4k3/8/8/8/8/4n3/8/R3K2R w KQ - 0 1', 'e1c1')).toBe(false);
    expect(legal('4k3/8/8/8/8/8/6p1/R3K2R w KQ - 0 1', 'e1g1')).toBe(false);
    expect(legal('4k3/8/8/8/8/8/6p1/R3K2R w KQ - 0 1', 'e1c1')).toBe(true);
  });
});

describe('castling rights are lost for good', () => {
  const bothSides = 'r3k2r/p6p/8/8/8/8/P6P/R3K2R w KQkq - 0 1';

  test('after the king moved and came back', () => {
    const back = playedAll(bothSides, ['e1e2', 'e8d8', 'e2e1', 'd8e8']);
    expect(back.startsWith('r3k2r/p6p/8/8/8/8/P6P/R3K2R w')).toBe(true);
    expect(castlingRights(back)).toBe('-');
    expect(legal(back, 'e1g1')).toBe(false);
    expect(legal(back, 'e1c1')).toBe(false);
    expect(legal(played(back, 'a2a3'), 'e8g8')).toBe(false);
    expect(legal(played(back, 'a2a3'), 'e8c8')).toBe(false);
  });

  test('after the rook moved and came back: only that wing', () => {
    const back = playedAll(bothSides, ['h1g1', 'a8b8', 'g1h1', 'b8a8']);
    expect(back.startsWith('r3k2r/p6p/8/8/8/8/P6P/R3K2R w')).toBe(true);
    expect(castlingRights(back)).toBe('Qk');
    expect(legal(back, 'e1g1')).toBe(false);
    expect(legal(back, 'e1h1')).toBe(false);
    expect(legal(back, 'e1c1')).toBe(true);
    expect(legal(played(back, 'a2a3'), 'e8c8')).toBe(false);
    expect(legal(played(back, 'a2a3'), 'e8g8')).toBe(true);
  });

  test('after the rook was captured at home, even with another rook there', () => {
    const fen = 'r3k2r/8/8/8/8/7R/6b1/R3K2R b KQkq - 0 1';
    const captured = played(fen, 'g2h1');
    expect(castlingRights(captured)).toBe('Qkq');
    const replaced = playedAll(captured, ['h3h1', 'a8b8']);
    expect(replaced.startsWith('1r2k2r/8/8/8/8/8/8/R3K2R w')).toBe(true);
    expect(castlingRights(replaced)).toBe('Qk');
    expect(legal(replaced, 'e1g1')).toBe(false);
    expect(legal(replaced, 'e1c1')).toBe(true);
  });
});

describe('en passant and the king', () => {
  test('refused when both pawns leave the rank and bare the king to a queen', () => {
    const pinned = '8/8/8/8/k2Pp2Q/8/8/3K4 b - d3 0 1';
    expect(legal(pinned, 'e4d3')).toBe(false);
    expect(legalMoves(pinned).some((m) => m.isEnPassant)).toBe(false);
    expect(legal(pinned, 'e4e3')).toBe(true);
  });

  test('allowed when it gives discovered check', () => {
    const capture = applyUci('4k3/8/8/3pP3/8/8/8/4RK2 w - d6 0 1', 'e5d6');
    expect(capture.ok && capture.san).toBe('exd6+');
    expect(capture.ok && capture.isCheck).toBe(true);
    expect(capture.ok && capture.fen.startsWith('4k3/8/3P4/8/')).toBe(true);
  });

  test('can be the only way out of check', () => {
    const checked = played('2B5/8/8/k1K5/p7/8/1P6/8 w - - 0 1', 'b2b4');
    expect(positionStatus(checked)).toEqual({
      isCheck: true,
      isCheckmate: false,
      isStalemate: false,
    });
    expect(legalMoves(checked).map((m) => [m.uci, m.isEnPassant])).toEqual([
      ['a4b3', true],
    ]);
    expect(played(checked, 'a4b3').startsWith('2B5/8/8/k1K5/8/1p6/8/8 w')).toBe(
      true
    );
  });
});

describe('promotion outcomes', () => {
  const backRank = '6k1/3P1ppp/8/8/8/8/8/6K1 w - - 0 1';

  test('the chosen piece stands on the last rank; queen and rook mate', () => {
    const outcomes = ['q', 'r', 'b', 'n'].map((piece) => {
      const result = applyUci(backRank, `d7d8${piece}`);
      if (!result.ok) throw new Error(result.reason);
      return [result.fen.split('/')[0], result.san, result.isCheckmate];
    });
    expect(outcomes).toEqual([
      ['3Q2k1', 'd8=Q#', true],
      ['3R2k1', 'd8=R#', true],
      ['3B2k1', 'd8=B', false],
      ['3N2k1', 'd8=N', false],
    ]);
  });

  test('black promotes on the first rank, with check, and by capture', () => {
    const fen = '6k1/8/8/8/8/8/p7/1N4K1 b - - 0 1';
    const push = applyUci(fen, 'a2a1q');
    expect(push.ok && push.san).toBe('a1=Q');
    expect(push.ok && push.fen.startsWith('6k1/8/8/8/8/8/8/qN4K1 w')).toBe(
      true
    );
    const capture = applyUci(fen, 'a2b1r');
    expect(capture.ok && capture.san).toBe('axb1=R+');
    expect(capture.ok && capture.isCheck).toBe(true);
    expect(
      capture.ok && capture.fen.startsWith('6k1/8/8/8/8/8/8/1r4K1 w')
    ).toBe(true);
  });

  test('a last-rank pawn move without a suffix is refused, capture or not', () => {
    const fen = '1n4k1/P7/8/8/8/8/p7/1N4K1 w - - 0 1';
    expect(legal(fen, 'a7a8')).toBe(false);
    expect(legal(fen, 'a7b8')).toBe(false);
    expect(legal(fen, 'a7b8k')).toBe(false);
    expect(legal(played(fen, 'g1g2'), 'a2a1')).toBe(false);
    expect(legal(played(fen, 'g1g2'), 'a2b1')).toBe(false);
    const chess = new Chess(fen);
    expect(playUci(chess, 'a7a8')).toBeNull();
    expect(chess.fen()).toBe(fen);
    expect(playUci(chess, 'a7a8n')).toBe('a8=N');
  });
});

describe('a move that ends the game', () => {
  const fen = '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1';

  test('stalemate and checkmate are told apart', () => {
    const stalemate = applyUci(fen, 'f1f7');
    expect(stalemate.ok && stalemate.san).toBe('Qf7');
    expect(
      stalemate.ok && [stalemate.isCheckmate, stalemate.isStalemate]
    ).toEqual([false, true]);
    const checkmate = applyUci(fen, 'f1f8');
    expect(checkmate.ok && checkmate.san).toBe('Qf8#');
    expect(
      checkmate.ok && [checkmate.isCheckmate, checkmate.isStalemate]
    ).toEqual([true, false]);
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
