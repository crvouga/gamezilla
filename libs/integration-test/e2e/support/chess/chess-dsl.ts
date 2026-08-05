import type { TestApp } from '../test-app';
import {
  continueFromSummary,
  openChessFromGames,
  openChessPuzzle,
  openChessStats,
  solveCurrentPuzzle,
} from './chess-puzzle-play';
import { createSpaceIfNeeded } from './chess-space';

/** High-level chess puzzle flows over a {@link TestApp}. */
export class ChessDSL {
  constructor(private readonly app: TestApp) {}

  async enterSpaceWithGames(): Promise<void> {
    await createSpaceIfNeeded(this.app);
  }

  async openChessPuzzle(): Promise<void> {
    await openChessFromGames(this.app);
    await openChessPuzzle(this.app);
  }

  async solveCurrentPuzzle(): Promise<void> {
    await solveCurrentPuzzle(this.app.driver);
  }

  async continueFromSummary(): Promise<void> {
    await continueFromSummary(this.app.driver);
  }

  async openStats(): Promise<void> {
    await openChessStats(this.app.driver);
  }
}

export function createChessDSL(app: TestApp): ChessDSL {
  return new ChessDSL(app);
}
