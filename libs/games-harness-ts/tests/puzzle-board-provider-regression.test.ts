import { expect, test } from 'bun:test';
import { CHESS_HARNESS_GAME } from '@libs/chess-root-harness-ts/chess-harness-game';
import { Chess } from 'chess.js';
import {
  PUZZLE_BOARD,
  puzzleBoardDriver,
} from './conformance/puzzles/puzzle-board-mount';

// regression: puzzle-board-missing-translation-provider
test('puzzle 01Xbe renders translated guidance and accepts g6g5 after g3h4', async () => {
  const chess = new Chess('8/3R3p/6pk/3p4/2p1b1P1/6KP/r7/4R3 w - - 0 41');
  chess.move({ from: 'g3', to: 'h4' });
  const played: string[] = [];
  const driver = puzzleBoardDriver(
    CHESS_HARNESS_GAME,
    { position: chess.fen() },
    played
  );
  try {
    await driver.launch();
    expect(await driver.snapshotHtml()).toContain('White pieces at the bottom');
    await CHESS_HARNESS_GAME.shared.automation.turns.perform(
      driver,
      PUZZLE_BOARD,
      'g6g5'
    );
    expect(played).toEqual(['g6g5']);
  } finally {
    await driver.close();
  }
});
