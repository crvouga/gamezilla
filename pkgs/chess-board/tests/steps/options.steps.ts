import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import {
  type BoardWorld,
  beginDrag,
  clearBoardEvidence,
  configureBoard,
  GREEN_CREAM,
  prepareFixedWidthPromotion,
  readBoard,
  readInteraction,
  readOptions,
  readPiece,
  readProbe,
  readPromotionChoices,
  selectSquare,
  setAvailableWidth,
  setFixedWidth,
  setupBoard,
  setupOfferedWhiteMove,
} from '@pkgs/chess-board/harness';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given('Alice has a chessboard facing Black with coordinates hidden', (w) =>
  w.apply(setupBoard, { orientation: 'black', showCoordinates: false })
);
Given('Alice has a chessboard without a fixed width', (w) =>
  w.apply(setupBoard, { size: undefined })
);
Given("Alice has a chessboard with the activity's fixed width", (w) =>
  w.apply(setupBoard, { size: 512 })
);
Given(
  'Alice has an interactive chessboard {int} pixels wide',
  (w, width: number) => w.apply(setupBoard, { size: width })
);
Given('Alice has a chessboard {int} pixels wide', (w, width: number) =>
  w.apply(setFixedWidth, width)
);
Given('Alice has a chessboard with coordinates hidden', (w) =>
  w.apply(setupBoard, { showCoordinates: false })
);
Given(
  'Alice has selected the piece on e2 with legal destination marks hidden',
  async (w) => {
    await w.apply(setupBoard, { highlightLegalMoves: false });
    await w.apply(selectSquare, 'e2');
  }
);
Given(
  "Alice has a chessboard after White's move from e2 to e4 with last move marks hidden",
  async (w) => {
    await w.apply(setupOfferedWhiteMove);
    await w.apply(configureBoard, { highlightLastMove: false });
  }
);
Given(
  'Alice has a chessboard 195 pixels wide after its selection was abandoned',
  async (w) => {
    await w.apply(setupBoard, {});
    await w.apply(selectSquare, 'e2');
    await w.apply(setFixedWidth, 195);
    await w.apply(clearBoardEvidence);
  }
);
When("Alice's activity narrows the available space", (w) =>
  w.apply(setAvailableWidth, 195)
);
When("Alice's activity chooses a fixed width", (w) =>
  w.apply(setFixedWidth, 512)
);
When("Alice's activity removes the fixed width", (w) =>
  w.apply(setFixedWidth, undefined)
);
When(
  "Alice's activity narrows the chessboard to {int} pixels wide",
  (w, width: number) => w.apply(setFixedWidth, width)
);
When(
  "Alice's activity widens the chessboard to {int} pixels wide",
  (w, width: number) => w.apply(setFixedWidth, width)
);
When("Alice's board settings show coordinates", (w) =>
  w.apply(configureBoard, { showCoordinates: true })
);
When("Alice's board settings hide coordinates", (w) =>
  w.apply(configureBoard, { showCoordinates: false })
);
When("Alice's board settings hide legal destination marks", (w) =>
  w.apply(configureBoard, { highlightLegalMoves: false })
);
When("Alice's board settings show legal destination marks", (w) =>
  w.apply(configureBoard, { highlightLegalMoves: true })
);
When("Alice's board settings hide last move marks", (w) =>
  w.apply(configureBoard, { highlightLastMove: false })
);
When("Alice's board settings show last move marks", (w) =>
  w.apply(configureBoard, { highlightLastMove: true })
);
When("Alice's activity chooses green and cream board colors", (w) =>
  w.apply(configureBoard, { theme: GREEN_CREAM })
);
Then("Alice's chessboard fills the available width", async (w) => {
  const view = await w.read(readOptions);
  expect(view.width).toBe(view.availableWidth);
  expect(view.measuredWidth).toBe(view.availableWidth);
});
Then("Alice's chessboard has equal width and height", async (w) => {
  const view = await w.read(readOptions);
  expect(view.width).toBe(view.height);
});
Then("Alice's chessboard (still )has the activity's fixed width", async (w) => {
  const view = await w.read(readOptions);
  if (view.suppliedWidth === undefined)
    throw new Error('No fixed width supplied');
  expect(view.width).toBe(view.suppliedWidth);
  expect(view.measuredWidth).toBe(view.suppliedWidth);
});
Then('Alice sees no selection', async (w) =>
  expect((await w.read(readInteraction)).selected).toBeNull()
);
Then(
  'Alice cannot {word} a piece while the chessboard is a preview',
  async (w, _gesture: string) => {
    expect((await w.read(readInteraction)).interactive).toBe(false);
    expect(await w.read(readBoard)).toMatchObject({
      holding: false,
      moves: [],
    });
  }
);
Then('Alice can select the piece on e2', async (w) => {
  expect((await w.read(readInteraction)).interactive).toBe(true);
  expect((await w.read(readOptions)).grabColors).toContain('w');
  expect(await w.read(readPiece, 'e2')).toEqual({
    side: 'White',
    piece: 'pawn',
  });
});
Then(
  'Alice sees coordinates for all eight files and all eight ranks',
  async (w) => {
    expect([...(await w.read(readOptions)).coordinates].sort()).toEqual(
      '12345678abcdefgh'.split('')
    );
  }
);
Then('Alice (still )sees no coordinates', async (w) =>
  expect((await w.read(readOptions)).coordinates).toEqual([])
);
Then('Alice (still )holds the piece from {word}', async (w, source: Square) => {
  expect((await w.read(readBoard)).holding).toBe(true);
  expect((await w.read(readOptions)).marks).toContain('selected@' + source);
});
Then(
  'Alice cannot see legal destination marks while they are hidden',
  async (w) => {
    expect(
      (await w.read(readOptions)).marks.filter(
        (t) => t.startsWith('dot@') || t.startsWith('ring@')
      )
    ).toEqual([]);
    expect((await w.read(readProbe)).legalTargets).toEqual(['e3', 'e4']);
  }
);
Then('Alice cannot see last move marks while they are hidden', async (w) => {
  expect(
    (await w.read(readOptions)).marks.filter((t) => t.startsWith('last-move@'))
  ).toEqual([]);
  expect((await w.read(readInteraction)).lastMove).toEqual({
    from: 'e2',
    to: 'e4',
  });
});
Then('Alice sees green and cream squares', async (w) =>
  expect(await w.read(readOptions)).toMatchObject({
    dark: 'green',
    light: '#f0d9b5',
  })
);

Given(
  'Alice has a chessboard 196 pixels wide with interactivity disabled',
  (w) => w.apply(setupBoard, { size: 196, interactive: false })
);
Given(
  'Alice has selected the piece on e2 with a fixed width and enough available space to move',
  async (w) => {
    await w.apply(setupBoard, { size: 512 });
    await w.apply(selectSquare, 'e2');
  }
);
Given(
  'Alice has a chessboard with a fixed width of 195 pixels and enough available space to move',
  (w) => w.apply(setupBoard, { size: 195 })
);
Given(
  'Alice has selected the piece on e2 with green and cream board colors',
  async (w) => {
    await w.apply(setupBoard, { theme: GREEN_CREAM });
    await w.apply(selectSquare, 'e2');
  }
);
When('Alice begins dragging the piece on {word}', (w, source: Square) =>
  w.apply(beginDrag, source)
);
When(
  "Alice's activity chooses a fixed width of {int} pixels",
  (w, width: number) => w.apply(setFixedWidth, width)
);
When("Alice's activity chooses brown and cream board colors", (w) =>
  w.apply(configureBoard, {
    theme: { darkSquare: '#b58863', lightSquare: '#f0d9b5' },
  })
);
Then(
  'Alice cannot {word} a piece while interactivity is disabled',
  async (w, _gesture: string) => {
    expect((await w.read(readInteraction)).interactive).toBe(false);
    expect(await w.read(readBoard)).toMatchObject({
      holding: false,
      moves: [],
    });
  }
);
Then('Alice sees brown and cream squares', async (w) =>
  expect(await w.read(readOptions)).toMatchObject({
    dark: '#b58863',
    light: '#f0d9b5',
  })
);

Given(
  'Alice has a pending White promotion from a7 to a8 at a fixed width of 512 pixels with 195 pixels available',
  async (w) => {
    await w.apply(prepareFixedWidthPromotion);
    expect(await w.read(readPromotionChoices)).toEqual([
      'queen',
      'rook',
      'bishop',
      'knight',
    ]);
  }
);
Given("Alice's activity now has 320 pixels available", (w) =>
  w.apply(setAvailableWidth, 320)
);
Then(
  'Alice sees a square chessboard {int} pixels wide',
  async (w, width: number) => {
    const view = await w.read(readOptions);
    expect(view.width).toBe(width);
    expect(view.height).toBe(width);
    expect(view.measuredWidth).toBe(width);
  }
);
