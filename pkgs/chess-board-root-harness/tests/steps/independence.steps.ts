import { expect } from 'bun:test';
import type { BoardWorld } from '@pkgs/chess-board-root-harness/board-world';
import {
  beginSeparateDrag,
  cancelSeparateDrag,
  closeSeparateBoard,
  configureSeparateInput,
  configureSeparateSound,
  moveSeparatePiece,
  preparePair,
  replaceSeparatePosition,
  selectSeparatePiece,
} from '@pkgs/chess-board-root-harness/pair-actions';
import { readPairModel } from '@pkgs/chess-board-root-harness/pair-reads';
import type { PairSide } from '@pkgs/chess-board-root-harness/pair-world';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-root-shared/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
const state = async (w: Run<BoardWorld>, name: PairSide) =>
  (await w.read(readPairModel)).chessboards[name];
async function prepare(
  w: Run<BoardWorld>,
  option: 'selected' | 'disabled' | 'silent' | 'closed'
) {
  await w.apply(preparePair);
  if (option === 'selected') {
    await w.apply(selectSeparatePiece, 'first');
    await w.apply(selectSeparatePiece, 'second');
  } else if (option === 'disabled') {
    await w.apply(configureSeparateInput, 'first', false);
    await w.apply(selectSeparatePiece, 'second');
  } else if (option === 'silent')
    await w.apply(configureSeparateSound, 'first', false);
  else await w.apply(closeSeparateBoard, 'first');
}
Given('Alice has two separate interactive chessboards', (w) =>
  w.apply(preparePair)
);
Given('Alice has e2 selected on the second chessboard', (w) =>
  w.apply(selectSeparatePiece, 'second')
);
Given('Alice has e2 selected on both chessboards', (w) =>
  prepare(w, 'selected')
);
Given(
  'Alice has a disabled first chessboard and e2 selected on the second chessboard',
  (w) => prepare(w, 'disabled')
);
Given(
  'Alice has a silent first chessboard and a second chessboard with sound enabled',
  (w) => prepare(w, 'silent')
);
Given(
  'Alice has closed the first chessboard while the second chessboard remains interactive',
  (w) => prepare(w, 'closed')
);
Given(
  'Alice holds e2 on the first chessboard and has e2 selected on the second',
  async (w) => {
    await w.apply(preparePair);
    await w.apply(selectSeparatePiece, 'second');
    await w.apply(beginSeparateDrag, 'first');
  }
);
When(
  'Alice moves the piece from e2 to e4 on the {word} chessboard',
  (w, name: PairSide) => w.apply(moveSeparatePiece, name)
);
When('Alice selects the piece on e2 on the first chessboard', (w) =>
  w.apply(selectSeparatePiece, 'first')
);
When('Alice begins dragging the piece on e2 on the first chessboard', (w) =>
  w.apply(beginSeparateDrag, 'first')
);
When('Alice cancels the drag on the first chessboard', (w) =>
  w.apply(cancelSeparateDrag, 'first')
);
When("Alice's first activity replaces its chessboard's position", (w) =>
  w.apply(replaceSeparatePosition, 'first')
);
When("Alice's first board settings disable interactivity", (w) =>
  w.apply(configureSeparateInput, 'first', false)
);
When("Alice's first board settings enable interactivity", (w) =>
  w.apply(configureSeparateInput, 'first', true)
);
When("Alice's first board settings disable sound", (w) =>
  w.apply(configureSeparateSound, 'first', false)
);
When("Alice's first board settings enable sound", (w) =>
  w.apply(configureSeparateSound, 'first', true)
);
When('Alice closes the first chessboard', (w) =>
  w.apply(closeSeparateBoard, 'first')
);
Then('Alice still has e2 selected on the second chessboard', async (w) =>
  expect((await state(w, 'second')).selected).toBe(true)
);
Then('Alice sees e2 selected on both chessboards', async (w) => {
  expect((await state(w, 'first')).selected).toBe(true);
  expect((await state(w, 'second')).selected).toBe(true);
});
Then('Alice holds the piece from e2 on the first chessboard', async (w) =>
  expect((await state(w, 'first')).held).toBe(true)
);
Then('Alice no longer holds a piece on the first chessboard', async (w) =>
  expect((await state(w, 'first')).held).toBe(false)
);
Then('Alice sees no selection on the first chessboard', async (w) =>
  expect((await state(w, 'first')).selected).toBe(false)
);
Then(
  'Alice sees a White pawn on e4 on the {word} chessboard',
  async (w, name: PairSide) =>
    expect((await state(w, name)).position).toBe('moved')
);
Then(
  'Alice sees the White pawn remaining on e2 on the {word} chessboard',
  async (w, name: PairSide) =>
    expect((await state(w, name)).position).toBe('opening')
);
Then('Alice sees the replacement position on the first chessboard', async (w) =>
  expect((await state(w, 'first')).position).toBe('replacement')
);
Then(
  "Alice sees the position before White's first move on the second chessboard",
  async (w) => expect((await state(w, 'second')).position).toBe('opening')
);
Then('Alice can move a piece on the first chessboard', async (w) =>
  expect((await state(w, 'first')).interactive).toBe(true)
);
Then(
  'Alice cannot move a piece on the first chessboard while interactivity is disabled',
  async (w) => expect((await state(w, 'first')).interactive).toBe(false)
);
Then("Alice's {word} chessboard has sound enabled", async (w, name: PairSide) =>
  expect((await state(w, name)).soundEnabled).toBe(true)
);
Then("Alice's first chessboard has sound disabled", async (w) =>
  expect((await state(w, 'first')).soundEnabled).toBe(false)
);
Then(
  "Alice's {word} activity receives one move while the {word} activity receives no moves",
  async (w, one: PairSide, none: PairSide) => {
    expect((await state(w, one)).offers).toEqual(['e2 to e4']);
    expect((await state(w, none)).offers).toEqual([]);
  }
);
Then("Alice's two activities receive no moves", async (w) => {
  expect((await state(w, 'first')).offers).toEqual([]);
  expect((await state(w, 'second')).offers).toEqual([]);
});
Then('Alice hears one move sound from the second chessboard', async (w) => {
  expect((await w.read(readPairModel)).heardBoardSounds).toEqual(['move']);
  expect((await state(w, 'second')).offers).toEqual(['e2 to e4']);
  expect((await state(w, 'first')).offers).toEqual([]);
});
Then('Alice hears no sound from the first chessboard', async (w) =>
  expect((await state(w, 'first')).offers).toEqual([])
);
Then(
  'Alice cannot hear chessboard sounds from the first board while its sound is disabled',
  async (w) => {
    expect((await state(w, 'first')).soundEnabled).toBe(false);
    expect((await w.read(readPairModel)).heardBoardSounds).toEqual([]);
  }
);
Then('Alice cannot see the first chessboard because it is closed', async (w) =>
  expect((await state(w, 'first')).present).toBe(false)
);
