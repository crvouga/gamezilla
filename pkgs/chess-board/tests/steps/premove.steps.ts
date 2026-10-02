import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import {
  type BoardWorld,
  clearBoardEvidence,
  configureBoard,
  dragPiece,
  movePiece,
  PREMOVE_READY,
  pressBoardKey,
  readActivityMoves,
  readInteraction,
  readPremoves,
  readProbe,
  selectSquare,
  setupBoard,
  supplyPremoveReply,
} from '@pkgs/chess-board/harness';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given('Alice has a chessboard waiting for Black with premoves enabled', (w) =>
  w.apply(setupBoard, {
    fen: PREMOVE_READY,
    premoves: true,
    enableUserArrows: true,
    animations: false,
  })
);
Given('Alice has a chessboard waiting for Black with premoves disabled', (w) =>
  w.apply(setupBoard, {
    fen: PREMOVE_READY,
    premoves: false,
    enableUserArrows: true,
    animations: false,
  })
);
Given(
  'Alice has the premove from d2 to d4 queued while waiting for Black',
  async (w) => {
    await w.apply(setupBoard, {
      fen: PREMOVE_READY,
      premoves: true,
      enableUserArrows: true,
      animations: false,
    });
    await w.apply(movePiece, 'd2', 'd4');
    await w.apply(clearBoardEvidence);
  }
);
Given(
  'Alice has premoves from d2 to d4 then g1 to f3 queued while waiting for Black',
  async (w) => {
    await w.apply(setupBoard, {
      fen: PREMOVE_READY,
      premoves: true,
      enableUserArrows: true,
      animations: false,
    });
    await w.apply(movePiece, 'd2', 'd4');
    await w.apply(movePiece, 'g1', 'f3');
    await w.apply(clearBoardEvidence);
  }
);
Given(
  'Alice has completed the premove from d2 to d4 with g1 to f3 still queued',
  async (w) => {
    await w.apply(setupBoard, {
      fen: PREMOVE_READY,
      premoves: true,
      enableUserArrows: true,
      animations: false,
    });
    await w.apply(movePiece, 'd2', 'd4');
    await w.apply(movePiece, 'g1', 'f3');
    await w.apply(supplyPremoveReply, 'e7', 'e5');
    await w.advanceTime(1000);
    await w.apply(clearBoardEvidence);
  }
);
When(
  'Alice queues the premove from {word} to {word}',
  (w, from: Square, to: Square) => w.apply(movePiece, from, to)
);
When(
  'Alice drags a premove from {word} to {word}',
  (w, from: Square, to: Square) => w.apply(dragPiece, from, to)
);
When("Alice's board settings enable premoves", (w) =>
  w.apply(configureBoard, { premoves: true })
);
When("Alice's board settings disable premoves", (w) =>
  w.apply(configureBoard, { premoves: false })
);
When("Alice's activity supplies Black's reply from g8 to f6", (w) =>
  w.apply(supplyPremoveReply, 'g8', 'f6')
);
When("Alice's activity supplies a reply that invalidates the premove", (w) =>
  w.apply(supplyPremoveReply, 'h2', 'd2')
);
When('Alice selects the empty square {word}', (w, square: Square) =>
  w.apply(selectSquare, square)
);
Then('Alice sees only the premove from d2 to d4 queued', async (w) =>
  expect((await w.read(readPremoves)).queued).toEqual([
    { from: 'd2', to: 'd4' },
  ])
);
When('Alice cancels premoves with Escape', (w) =>
  w.apply(pressBoardKey, 'Escape')
);
Then('Alice sees a translucent White pawn preview on d4', async (w) => {
  const view = await w.read(readPremoves);
  expect(view.previews).toHaveLength(1);
  expect(view.previews[0]?.token).toBe('premove-ghost:wp@d4');
  expect(Number(view.previews[0]?.opacity)).toBeGreaterThan(0);
  expect(Number(view.previews[0]?.opacity)).toBeLessThan(1);
});
Then("Alice cannot select White's pawn while Black is to move", async (w) => {
  expect(await w.read(readInteraction)).toMatchObject({
    selected: null,
    sideToMove: 'Black',
  });
});
Then('Alice can queue a premove while waiting for Black', async (w) => {
  expect((await w.read(readPremoves)).enabled).toBe(true);
  expect(await w.read(readInteraction)).toMatchObject({
    interactive: true,
    sideToMove: 'Black',
  });
});
Then('Alice sees no queued premoves', async (w) =>
  expect(await w.read(readPremoves)).toMatchObject({ queued: [], previews: [] })
);

Then('Alice sees only the premove from g1 to f3 queued', async (w) =>
  expect((await w.read(readPremoves)).queued).toEqual([
    { from: 'g1', to: 'f3' },
  ])
);
Then(
  'Alice cannot complete the premove because it is no longer legal',
  async (w) => {
    expect((await w.read(readPremoves)).queued).toEqual([]);
    expect(await w.read(readActivityMoves)).toEqual([]);
    expect((await w.read(readProbe)).pieces).not.toContainEqual(
      expect.objectContaining({ square: 'd2', piece: 'wp' })
    );
  }
);
Then(
  'Alice cannot keep a premove queued while premoves are disabled',
  async (w) =>
    expect(await w.read(readPremoves)).toMatchObject({
      enabled: false,
      queued: [],
      previews: [],
    })
);

Then(
  'Alice still sees exactly one translucent White pawn preview on d4',
  async (w) => {
    const view = await w.read(readPremoves);
    expect(view.queued).toEqual([{ from: 'd2', to: 'd4' }]);
    expect(view.previews).toHaveLength(1);
    expect(view.previews[0]?.token).toBe('premove-ghost:wp@d4');
    expect(Number(view.previews[0]?.opacity)).toBeGreaterThan(0);
    expect(Number(view.previews[0]?.opacity)).toBeLessThan(1);
  }
);
Then('Alice cannot queue a premove while premoves are disabled', async (w) => {
  expect(await w.read(readPremoves)).toMatchObject({
    enabled: false,
    queued: [],
    previews: [],
  });
  expect(await w.read(readActivityMoves)).toEqual([]);
});

Given(
  'Alice has d2 selected while waiting for Black with premoves enabled',
  async (w) => {
    await w.apply(setupBoard, {
      fen: PREMOVE_READY,
      premoves: true,
      enableUserArrows: true,
      animations: false,
    });
    await w.apply(selectSquare, 'd2');
    await w.apply(clearBoardEvidence);
  }
);
