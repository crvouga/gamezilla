import { Handles } from '@libs/test-ids';
import { ChessBoardFlows } from '@pkgs/chess-board/chess-board-flows';
import type { ChessBoardProbe } from '@pkgs/chess-board/chess-board-probe';
import type { Square } from '@pkgs/chess-board/chess-board-types';

import type { ActorScript } from './actor-script';
import type { SpaceFlows } from './space-flows';

/** Virtual-time budgets for puzzle screens to settle. */
const WAIT_MS = 15_000;
const INTERACTIVE_MS = 2_500;
const POLL_MS = 250;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
}

export class ChessFlows {
  readonly board: ChessBoardFlows;

  constructor(
    private readonly actor: ActorScript,
    private readonly space: SpaceFlows
  ) {
    this.board = new ChessBoardFlows(actor.ui, Handles.chessPuzzleBoard);
  }

  private get ui() {
    return this.actor.ui;
  }

  /**
   * Runtime path: ensure an active space, pick Chess → Puzzle, wait for board.
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
      await this.ui.get(Handles.navBack).expect.visible({ timeoutMs: WAIT_MS });
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
    return this.actor.pollUntil(
      async () => {
        for (const id of puzzleIds) {
          if (await this.ui.get(Handles.chessGameLogRow(id)).isVisible()) {
            return id;
          }
        }
        return null;
      },
      {
        maxMs: WAIT_MS,
        stepMs: POLL_MS,
        description: `game-log row among ${puzzleIds.join(', ')}`,
      }
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
    const mine = await this.board.readProbe();
    await peer.resumePuzzlePlay(hostUsername);
    await peer.pollUntilProbeMatches(mine);
  }

  private async pollUntilProbeMatches(
    expected: ChessBoardProbe
  ): Promise<void> {
    await this.actor.pollUntil(
      async () => {
        const seen = await this.board.readProbe();
        return probesMatch(expected, seen) ? true : null;
      },
      {
        maxMs: WAIT_MS,
        stepMs: POLL_MS,
        description: `board fen ${expected.fen}`,
      }
    );
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
    try {
      await this.actor.pollUntil(
        async () => {
          if (await this.isSolved()) return true;
          return (await this.readE2eField(1)) === '1' ? true : null;
        },
        {
          maxMs: INTERACTIVE_MS,
          stepMs: POLL_MS,
          description: 'puzzle interactive or solved',
        }
      );
    } catch {
      // Spectators never become interactive — proceed either way.
    }
  }

  private async readE2eField(index: number): Promise<string | undefined> {
    try {
      const raw = stripProbe(
        await this.ui.get(Handles.chessPuzzleE2eDebug).text()
      );
      return raw.split('|')[index];
    } catch {
      return undefined;
    }
  }

  private async waitExpectedUci(): Promise<string> {
    const node = this.ui.get(Handles.chessPuzzleExpectedUci);
    await node.wait('visible', { timeoutMs: WAIT_MS });
    return this.actor.pollUntil(
      async () => {
        if (await this.isSolved()) {
          throw new Error('expected UCI but puzzle already solved');
        }
        const uci = stripProbe(await node.text()).toLowerCase();
        return uci.length >= 4 ? uci : null;
      },
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'expected uci' }
    );
  }

  /**
   * After a human ply: wait until the next human UCI is ready, or the puzzle
   * is solved. Do not treat the just-played UCI as "next move ready".
   */
  private async waitAfterHumanMove(playedUci: string): Promise<void> {
    const played = playedUci.trim().toLowerCase();
    const node = this.ui.get(Handles.chessPuzzleExpectedUci);
    try {
      await this.actor.pollUntil(
        async () => {
          if (await this.isSolved()) return true;
          const uci = stripProbe(await node.text()).toLowerCase();
          return uci.length >= 4 && uci !== played ? true : null;
        },
        { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'next expected uci' }
      );
    } catch {
      // Best effort, as before: the caller's next assertion reports the truth.
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
