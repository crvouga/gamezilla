import type { Driver } from '@pkgs/ui-testing-shared/driver';
import { squareCenter } from './geometry';
import type { ChessBoardProbe } from './probe';
import {
  chessBoardProbeTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
  parseChessBoardProbe,
} from './probe';
import type { BoardOrientation, PieceCode, Square } from './types';

const WAIT_MS = 10_000;
const POLL_MS = 100;
const PIECE_XY_EPS = 1.5;

/**
 * Square-oriented board flows. Authors speak algebraic squares; the Driver
 * only ever receives x/y ratios derived from layout + orientation.
 */
export class ChessBoardFlows {
  private readonly boardTestId: string;
  private readonly probeTestId: string;

  constructor(
    private readonly ui: Driver,
    boardTestId: string = DEFAULT_CHESS_BOARD_TEST_ID
  ) {
    this.boardTestId = boardTestId;
    this.probeTestId = chessBoardProbeTestId(boardTestId);
  }

  async waitReady(opts?: { readonly timeoutMs?: number }): Promise<void> {
    const timeoutMs = opts?.timeoutMs ?? WAIT_MS;
    await this.ui.get(this.boardTestId).wait('visible', {
      timeoutMs,
      description: `${this.boardTestId} board`,
    });
    await this.waitProbe((p) => p.size > 0, { timeoutMs });
  }

  async readProbe(): Promise<ChessBoardProbe> {
    const text = await this.ui.get(this.probeTestId).text();
    return parseChessBoardProbe(text);
  }

  async tapSquare(square: Square): Promise<void> {
    const probe = await this.readProbe();
    const ratio = squareToRatio(square, probe.size, probe.orientation);
    await this.ui.get(this.boardTestId).tapAt(ratio);
  }

  async drag(from: Square, to: Square): Promise<void> {
    const probe = await this.readProbe();
    const fromRatio = squareToRatio(from, probe.size, probe.orientation);
    const toRatio = squareToRatio(to, probe.size, probe.orientation);
    await this.ui.get(this.boardTestId).drag(fromRatio, toRatio);
  }

  async expectPiece(
    square: Square,
    piece: PieceCode | null,
    opts?: { readonly timeoutMs?: number }
  ): Promise<void> {
    await this.waitProbe((probe) => {
      const found = probe.pieces.find((p) => p.square === square);
      if (piece === null) return found === undefined;
      return found?.piece === piece;
    }, opts);
  }

  async expectPieceAt(
    square: Square,
    piece: PieceCode,
    opts?: { readonly timeoutMs?: number; readonly epsilon?: number }
  ): Promise<void> {
    const epsilon = opts?.epsilon ?? PIECE_XY_EPS;
    await this.waitProbe((probe) => {
      const found = probe.pieces.find((p) => p.square === square);
      if (found === undefined || found.piece !== piece) return false;
      const expected = squareCenter(square, probe.size, probe.orientation);
      return (
        Math.abs(found.x - expected.x) <= epsilon &&
        Math.abs(found.y - expected.y) <= epsilon
      );
    }, opts);
  }

  async expectFen(
    fen: string,
    opts?: { readonly timeoutMs?: number }
  ): Promise<void> {
    await this.waitProbe((probe) => probe.fen === fen, opts);
  }

  private async waitProbe(
    predicate: (probe: ChessBoardProbe) => boolean,
    opts?: { readonly timeoutMs?: number }
  ): Promise<ChessBoardProbe> {
    const timeoutMs = opts?.timeoutMs ?? WAIT_MS;
    const maxAttempts = Math.max(1, Math.ceil(timeoutMs / POLL_MS));
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await this.ui
          .get(this.probeTestId)
          .expect.visible({ timeoutMs: POLL_MS });
        const probe = await this.readProbe();
        if (predicate(probe)) return probe;
        lastError = new Error(
          `chess board probe predicate failed (fen=${probe.fen})`
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `Timed out waiting for chess board probe (${this.probeTestId})`,
      { cause: lastError instanceof Error ? lastError : undefined }
    );
  }
}

function squareToRatio(
  square: Square,
  size: number,
  orientation: BoardOrientation
): { xRatio: number; yRatio: number } {
  const { x, y } = squareCenter(square, size, orientation);
  return { xRatio: x / size, yRatio: y / size };
}
