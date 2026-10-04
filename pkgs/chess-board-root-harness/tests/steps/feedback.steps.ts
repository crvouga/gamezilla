import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { BoardWorld } from '@pkgs/chess-board-root-harness/board-world';
import type { Side } from '@pkgs/chess-board-root-harness/interaction-fixtures';
import {
  readAnnouncement,
  readCompletedFeedback,
  readInteraction,
  readPiece,
} from '@pkgs/chess-board-root-harness/interaction-reads';
import { readSoundAuthority } from '@pkgs/chess-board-root-harness/promotion-access';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-root-shared/run-types';

const { Then } = stepsFor<Run<BoardWorld>>();
Then('Alice hears one capture sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'capture',
  ])
);
Then('Alice hears one illegal move sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'illegal',
  ])
);
Then('Alice hears one castle sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'castle',
  ])
);
Then('Alice hears no castle sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).not.toContain(
    'castle'
  )
);
Then('Alice hears no capture sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).not.toContain(
    'capture'
  )
);
Then('Alice hears one move sound with no check or end sounds', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'move',
  ])
);
Then('Alice hears one move sound followed by one check sound', async (w) =>
  expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
    'move',
    'check',
  ])
);
Then(
  'Alice hears one move sound followed by one check sound and one end sound',
  async (w) =>
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'move',
      'check',
      'gameEnd',
    ])
);
Then(
  'Alice hears one capture sound followed by one check sound and one end sound',
  async (w) =>
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'capture',
      'check',
      'gameEnd',
    ])
);
Then(
  'Alice hears one move sound followed by one end sound with no check sound',
  async (w) =>
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'move',
      'gameEnd',
    ])
);
Then(
  "Alice sees {word}'s king on {word} marked as in check",
  async (w, side: Side, square: Square) => {
    expect((await w.read(readInteraction)).checkMarks).toEqual([
      `check@${square}`,
    ]);
    expect(await w.read(readPiece, square)).toEqual({ side, piece: 'king' });
  }
);
Then('Alice sees neither king marked as in check', async (w) =>
  expect((await w.read(readInteraction)).checkMarks).toEqual([])
);
Then('Alice is told Black is in check', async (w) => {
  expect(await w.read(readAnnouncement)).toContain('check');
  expect(await w.read(readInteraction)).toMatchObject({
    sideToMove: 'Black',
    status: 'playing',
  });
});
Then('Alice is told Black is checkmated', async (w) => {
  expect(await w.read(readAnnouncement)).toContain('checkmate');
  expect(await w.read(readInteraction)).toMatchObject({
    sideToMove: 'Black',
    status: 'checkmate',
  });
});
Then('Alice is told Black is stalemated', async (w) => {
  expect(await w.read(readAnnouncement)).toContain('stalemate');
  expect(await w.read(readInteraction)).toMatchObject({
    sideToMove: 'Black',
    status: 'stalemate',
  });
});
Then(
  'Alice hears one capture sound followed by one promotion sound',
  async (w) =>
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([
      'capture',
      'promote',
    ])
);

Then(
  'Alice cannot hear (delayed )chessboard sounds while/after sound is disabled',
  async (w) => {
    expect((await w.read(readSoundAuthority)).enabled).toBe(false);
    expect(await w.until(readCompletedFeedback, { maxMs: 1000 })).toEqual([]);
  }
);
