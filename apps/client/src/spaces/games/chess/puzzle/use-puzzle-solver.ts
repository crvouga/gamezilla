import type { Move } from '@gamezilla/client/spaces/games/chess/chess-board';
import { Chess } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyUci,
  boardOrientationFromFen,
  uciFromMove,
} from './puzzle-play-chess-utils';

export type SolveStatus =
  | 'loading'
  | 'solving'
  | 'wrong'
  | 'solved'
  | 'invalid';

export function usePuzzleSolver(args: {
  fen: string;
  movesStr: string;
  puzzleId: string;
  resetNonce: number;
}): {
  displayFen: string | null;
  boardKey: number;
  status: SolveStatus;
  orientation: 'white' | 'black';
  onMove: (m: Move) => void;
} {
  const { fen, movesStr, puzzleId, resetNonce } = args;
  const chessRef = useRef(new Chess());
  const tokensRef = useRef<readonly string[]>([]);
  const [solveIdx, setSolveIdx] = useState(0);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [status, setStatus] = useState<SolveStatus>('loading');

  useEffect(() => {
    if (fen.length === 0 || movesStr.length === 0) {
      setStatus('loading');
      setDisplayFen(null);
      return;
    }
    const chess = chessRef.current;
    chess.reset();
    let loadOk = true;
    try {
      chess.load(fen);
    } catch {
      loadOk = false;
    }
    const wantBoard = fen.trim().split(/\s+/)[0];
    const gotBoard = chess.fen().trim().split(/\s+/)[0];
    if (wantBoard !== undefined && gotBoard !== wantBoard) {
      loadOk = false;
    }
    if (!loadOk) {
      setStatus('invalid');
      setDisplayFen(null);
      return;
    }
    const tokens = movesStr
      .trim()
      .split(/\s+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    if (tokens.length === 0) {
      setStatus('invalid');
      return;
    }
    tokensRef.current = tokens;
    const first = tokens[0];
    if (first === undefined) {
      setStatus('invalid');
      return;
    }
    if (!applyUci(chess, first)) {
      setStatus('invalid');
      return;
    }
    setSolveIdx(1);
    setDisplayFen(chess.fen());
    setBoardKey((k) => k + 1);
    setStatus(tokens.length <= 1 ? 'solved' : 'solving');
  }, [fen, movesStr, puzzleId, resetNonce]);

  const onMove = useCallback(
    (m: Move) => {
      if (status !== 'solving' && status !== 'wrong') return;
      const tokens = tokensRef.current;
      const expected = tokens[solveIdx];
      if (expected === undefined) return;
      const actual = uciFromMove(m).toLowerCase();
      if (actual !== expected) {
        chessRef.current.load(displayFen ?? fen);
        setBoardKey((k) => k + 1);
        setStatus('wrong');
        return;
      }
      const chess = chessRef.current;
      const moved = chess.move({
        from: m.from,
        to: m.to,
        ...(m.promotion !== undefined ? { promotion: m.promotion } : {}),
      });
      if (moved === null) {
        setStatus('invalid');
        return;
      }
      let nextIdx = solveIdx + 1;
      if (nextIdx >= tokens.length) {
        setDisplayFen(chess.fen());
        setSolveIdx(nextIdx);
        setBoardKey((k) => k + 1);
        setStatus('solved');
        return;
      }
      const reply = tokens[nextIdx];
      if (reply === undefined) {
        setDisplayFen(chess.fen());
        setSolveIdx(nextIdx);
        setBoardKey((k) => k + 1);
        setStatus('solved');
        return;
      }
      if (!applyUci(chess, reply)) {
        setStatus('invalid');
        return;
      }
      nextIdx += 1;
      setSolveIdx(nextIdx);
      setDisplayFen(chess.fen());
      setBoardKey((k) => k + 1);
      setStatus(nextIdx >= tokens.length ? 'solved' : 'solving');
    },
    [displayFen, fen, solveIdx, status]
  );

  const orientation =
    displayFen !== null ? boardOrientationFromFen(displayFen) : 'white';

  return { displayFen, boardKey, status, orientation, onMove };
}
