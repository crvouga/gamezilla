import type { Page } from '@playwright/test';

import {
  continueFromSummary,
  createSpaceIfNeeded,
  openChessFromGames,
  openChessPuzzle,
  openChessStats,
  solveCurrentPuzzle,
} from '../helpers/chess-puzzle';

/** High-level chess puzzle flows for Playwright specs. */
export class ChessDSL {
  constructor(private readonly page: Page) {}

  async enterSpaceWithGames(): Promise<void> {
    await createSpaceIfNeeded(this.page);
  }

  async openChessPuzzle(): Promise<void> {
    await openChessFromGames(this.page);
    await openChessPuzzle(this.page);
  }

  async solveCurrentPuzzle(): Promise<void> {
    await solveCurrentPuzzle(this.page);
  }

  async continueFromSummary(): Promise<void> {
    await continueFromSummary(this.page);
  }

  async openStats(): Promise<void> {
    await openChessStats(this.page);
  }
}

export function createChessDSL(page: Page): ChessDSL {
  return new ChessDSL(page);
}
