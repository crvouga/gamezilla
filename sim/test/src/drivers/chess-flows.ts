import { Handles } from '@libs/dst-handles';
import { ChessBoardFlows } from '@pkgs/chess-board/chess-board-flows';
import type { ChessBoardProbe } from '@pkgs/chess-board/chess-board-probe';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { wallClock } from '@pkgs/clock';
import type { Driver } from '@pkgs/ui-testing';

import type { SpaceFlows } from './space-flows';

const WAIT_MS = 15_000;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
}

/** Fail-fast wall backstop; drain pump advances sim time between checks. */
export class ChessFlows {
  readonly board: ChessBoardFlows;

  constructor(
    private readonly ui: Driver,
    private readonly space: SpaceFlows
  ) {
    this.board = new ChessBoardFlows(ui, Handles.chessPuzzleBoard);
  }

  /**
   * Host path: ensure an active space, pick Chess → Puzzle, wait for board.
   */
  async openPuzzleFromSpace(): Promise<void> {
    await this.space.expectActiveSpace();
    await this.ui
      .get(Handles.gameMenuChess)
      .expect.visible({ timeoutMs: WAIT_MS });
    await this.ui.get(Handles.gameMenuChess).tap({ timeoutMs: WAIT_MS });
    await this.ui
      .get(Handles.chessMenuPuzzle)
      .expect.visible({ timeoutMs: WAIT_MS });
    await this.ui.get(Handles.chessMenuPuzzle).tap({ timeoutMs: WAIT_MS });
    await this.expectPlayReady();
  }

  /** Guest path: follow host into puzzle once room screen is shared. */
  async expectPuzzlePlayScreen(): Promise<void> {
    await this.ui
      .get(Handles.chessPuzzlePlayScreen)
      .expect.visible({ timeoutMs: WAIT_MS });
    await this.expectPlayReady();
  }

  /**
   * Multi-app RNTL mounts one actor — remount drops Expo routes. Re-open the
   * live space; room state (selected game + chess screen) restores puzzle play.
   */
  async resumePuzzlePlay(hostUsername: string): Promise<void> {
    await this.space.reenterActiveSpace(hostUsername);
    await this.expectPuzzlePlayScreen();
  }

  async expectPlayReady(): Promise<void> {
    await this.ui
      .get(Handles.chessPuzzlePlayScreen)
      .expect.visible({ timeoutMs: WAIT_MS });
    // RNTL has no Yoga: synthesize frame onLayout so the square slot mounts.
    const frame = this.ui.get(Handles.chessPuzzleBoardFrame);
    await frame.layout();
    await this.board.waitReady({ timeoutMs: WAIT_MS });
    // Second layout after first paint — multi-actor mounts can measure late.
    await frame.layout();
    await this.board.waitReady({ timeoutMs: WAIT_MS });
    await this.waitUntilInteractiveOrSolved();
  }

  async playUci(uci: string): Promise<void> {
    const squares = parseUciSquares(uci);
    await this.board.drag(squares.from, squares.to);
  }

  /** Play the currently expected human ply from the E2E probe. */
  async playExpectedMove(): Promise<void> {
    const uci = await this.waitExpectedUci();
    await this.playUci(uci);
    await this.waitAfterHumanMove(uci);
  }

  async playUntilSolved(opts?: { readonly maxMoves?: number }): Promise<void> {
    const maxMoves = opts?.maxMoves ?? 16;
    for (let i = 0; i < maxMoves; i += 1) {
      if (await this.isSolved()) {
        await this.expectSolved();
        return;
      }
      await this.playExpectedMove();
    }
    await this.expectSolved();
  }

  async expectSolved(): Promise<void> {
    await this.ui
      .get(Handles.chessPuzzleSummary)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async tapNext(): Promise<void> {
    await this.ui
      .get(Handles.chessPuzzleActionNext)
      .expect.visible({ timeoutMs: WAIT_MS });
    await this.ui
      .get(Handles.chessPuzzleActionNext)
      .tap({ timeoutMs: WAIT_MS });
  }

  async openStats(): Promise<void> {
    // Puzzle play / celebration → chess root via chrome back, then Stats.
    if (!(await this.ui.get(Handles.chessMenuStats).isVisible())) {
      await this.ui
        .get(Handles.navBack)
        .expect.visible({ timeoutMs: WAIT_MS });
      await this.ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
      await this.ui
        .get(Handles.chessMenuStats)
        .expect.visible({ timeoutMs: WAIT_MS });
    }
    await this.ui.get(Handles.chessMenuStats).tap({ timeoutMs: WAIT_MS });
    await this.ui
      .get(Handles.chessStatsElo)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async expectStatsEloVisible(): Promise<void> {
    await this.ui
      .get(Handles.chessStatsElo)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  async readBoardElo(): Promise<string | null> {
    return this.ui.get(Handles.chessPuzzleBoardElo).text();
  }

  async readStatsElo(): Promise<string | null> {
    return this.ui.get(Handles.chessStatsElo).text();
  }

  async expectGameLogEntry(puzzleId: string): Promise<void> {
    await this.ui.get(Handles.chessGameLogRow(puzzleId)).wait('visible', {
      timeoutMs: WAIT_MS,
      description: `game-log row ${puzzleId}`,
    });
  }

  /** First visible career row among known seeded puzzle ids. */
  async findVisibleGameLogPuzzleId(
    puzzleIds: readonly string[]
  ): Promise<string> {
    const deadline = wallClock.now() + WAIT_MS;
    const probe = this.ui.get(Handles.chessStatsElo);
    while (wallClock.now() < deadline) {
      for (const id of puzzleIds) {
        if (await this.ui.get(Handles.chessGameLogRow(id)).isVisible()) {
          return id;
        }
      }
      await this.pumpProbe(probe);
    }
    throw new Error(
      `no game-log row among ${puzzleIds.join(', ')} within ${WAIT_MS}ms`
    );
  }

  async openReview(puzzleId: string): Promise<void> {
    await this.ui.get(Handles.chessGameLogRow(puzzleId)).tap({
      timeoutMs: WAIT_MS,
    });
    // Same frame testID as play — review remounts it; synthesize onLayout.
    const frame = this.ui.get(Handles.chessPuzzleBoardFrame);
    await frame.expect.visible({ timeoutMs: WAIT_MS });
    await frame.layout();
    await this.ui.get(Handles.chessPuzzleReviewBoard).wait('visible', {
      timeoutMs: WAIT_MS,
      description: 'chess-puzzle-review-board',
    });
  }

  async expectMoveHistoryVisible(): Promise<void> {
    await this.ui
      .get(Handles.chessPuzzleMoveHistory)
      .expect.visible({ timeoutMs: WAIT_MS });
  }

  /**
   * Compare board probes across actors. Each read remounts that actor, so both
   * re-enter puzzle play first; peer fen is polled until it matches (guest
   * optimistic drag may briefly diverge).
   */
  async expectProbeMatchesPeer(
    peer: ChessFlows,
    hostUsername: string
  ): Promise<void> {
    await this.resumePuzzlePlay(hostUsername);
    const a = await this.board.readProbe();
    await peer.resumePuzzlePlay(hostUsername);
    const deadline = wallClock.now() + WAIT_MS;
    let lastFen = '';
    while (wallClock.now() < deadline) {
      const b = await peer.board.readProbe();
      lastFen = b.fen;
      if (probesMatch(a, b)) return;
      await peer.drainBriefly();
    }
    throw new Error(
      `board fen mismatch after ${WAIT_MS}ms: ${a.fen} vs ${lastFen}`
    );
  }

  /** Advance the sim wait pump without asserting. */
  async drainBriefly(): Promise<void> {
    await this.pumpProbe(this.ui.get(Handles.chessPuzzleBoard));
  }

  private async isSolved(): Promise<boolean> {
    if (await this.ui.get(Handles.chessPuzzleSummary).isVisible()) {
      return true;
    }
    try {
      const debug = stripProbe(
        await this.ui.get(Handles.chessPuzzleE2eDebug).text()
      );
      return debug.startsWith('solved|');
    } catch {
      return false;
    }
  }

  private async waitUntilInteractiveOrSolved(): Promise<void> {
    // Opening opponent ply ~450ms + move; spectators never go interactive.
    const deadline = wallClock.now() + 2_500;
    const debugNode = this.ui.get(Handles.chessPuzzleE2eDebug);
    while (wallClock.now() < deadline) {
      if (await this.isSolved()) return;
      try {
        const raw = stripProbe(await debugNode.text());
        const interactive = raw.split('|')[1];
        if (interactive === '1') return;
      } catch {
        // keep pumping
      }
      await this.pumpProbe(debugNode);
    }
  }

  private async waitExpectedUci(): Promise<string> {
    const node = this.ui.get(Handles.chessPuzzleExpectedUci);
    await node.wait('visible', { timeoutMs: WAIT_MS });
    const deadline = wallClock.now() + WAIT_MS;
    while (wallClock.now() < deadline) {
      if (await this.isSolved()) {
        throw new Error('expected UCI but puzzle already solved');
      }
      const uci = stripProbe(await node.text()).toLowerCase();
      if (uci.length >= 4) return uci;
      await this.pumpProbe(node);
    }
    const text = await node.text();
    let debug = '';
    try {
      debug = stripProbe(await this.ui.get(Handles.chessPuzzleE2eDebug).text());
    } catch {
      debug = '(missing)';
    }
    throw new Error(
      `expected uci timed out: ${JSON.stringify(text)} debug=${JSON.stringify(debug)}`
    );
  }

  /**
   * After a human ply: wait until the next human UCI is ready, or the puzzle
   * is solved. Do not treat the just-played UCI as "next move ready".
   */
  private async waitAfterHumanMove(playedUci: string): Promise<void> {
    const played = playedUci.trim().toLowerCase();
    const deadline = wallClock.now() + WAIT_MS;
    const node = this.ui.get(Handles.chessPuzzleExpectedUci);
    while (wallClock.now() < deadline) {
      if (await this.isSolved()) return;
      try {
        const uci = stripProbe(await node.text()).toLowerCase();
        if (uci.length >= 4 && uci !== played) return;
      } catch {
        // keep waiting
      }
      await this.pumpProbe(node);
    }
  }

  private async pumpProbe(node: {
    wait: (
      state: { text: string; exact: boolean },
      options: { timeoutMs: number; description: string }
    ) => Promise<void>;
  }): Promise<void> {
    try {
      await node.wait(
        { text: '\0', exact: true },
        { timeoutMs: 100, description: 'sim pump' }
      );
    } catch {
      // expected — advances the drain pump
    }
  }
}

function parseUciSquares(uci: string): { from: Square; to: Square } {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) {
    throw new Error(`invalid uci: ${uci}`);
  }
  const from = t.slice(0, 2) as Square;
  const to = t.slice(2, 4) as Square;
  return { from, to };
}

function probesMatch(a: ChessBoardProbe, b: ChessBoardProbe): boolean {
  if (a.fen !== b.fen) return false;
  if (a.pieces.length !== b.pieces.length) return false;
  for (let i = 0; i < a.pieces.length; i += 1) {
    const left = a.pieces[i]!;
    const right = b.pieces[i]!;
    if (
      left.square !== right.square ||
      left.piece !== right.piece ||
      Math.abs(left.x - right.x) > 1.5 ||
      Math.abs(left.y - right.y) > 1.5
    ) {
      return false;
    }
  }
  return true;
}
