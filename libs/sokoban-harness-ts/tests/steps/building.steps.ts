import { expect } from 'bun:test';
import {
  offeredDraftEdits,
  redoDraftEditInBuilder,
  undoDraftEditInBuilder,
} from '@libs/game-puzzle-harness-ts/builder-session';
import { reopenContentDevice } from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  boardBeforeEdit,
  builderSays,
  buildSokobanBoard,
  builtDefinition,
  editSokobanSquare,
  ownSokobanDraft,
  previewWords,
  resizeSokobanBoard,
  type SokobanTool,
} from '@libs/sokoban-harness-ts/sokoban-building';
import {
  boardWords,
  type LayoutTable,
  tableWords,
} from '@libs/sokoban-harness-ts/sokoban-layout';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { Given, Then, When } from './world';

const ALICE = 'alice:phone';
type World = Parameters<Parameters<typeof Given>[1]>[0];

const edit = (w: World, tool: SokobanTool, square: string) =>
  w.run.apply(editSokobanSquare, tool, square);

Given(
  'Alice is building a Sokoban board laid out as:',
  async (w, table: LayoutTable) => {
    await w.run.apply(buildSokobanBoard, table);
  }
);

Given(
  'Alice owns the Sokoban draft {string} laid out as:',
  async (w, title: string, table: LayoutTable) => {
    await w.run.apply(ownSokobanDraft, title, table);
  }
);

When(
  'Alice changes the board size to {int} columns and {int} rows',
  async (w, columns: number, rows: number) => {
    await w.run.apply(resizeSokobanBoard, columns, rows);
  }
);

When('Alice paints {string} as a wall', (w, square: string) =>
  edit(w, 'wall', square)
);
When('Alice paints {string} as a goal', (w, square: string) =>
  edit(w, 'goal', square)
);
When('Alice paints {string} as floor', (w, square: string) =>
  edit(w, 'floor', square)
);
When('Alice paints {string} as outside', (w, square: string) =>
  edit(w, 'outside', square)
);
Given('Alice has painted {string} as a wall', (w, square: string) =>
  edit(w, 'wall', square)
);
Given(
  'Alice has undone painting {string} as a wall',
  async (w, square: string) => {
    await edit(w, 'wall', square);
    await w.run.apply(undoDraftEditInBuilder, ALICE);
  }
);
When('Alice places the worker on {string}', (w, square: string) =>
  edit(w, 'worker', square)
);
When('Alice places a crate on {string}', (w, square: string) =>
  edit(w, 'crate', square)
);
When('Alice removes the crate on {string}', (w, square: string) =>
  edit(w, 'remove-crate', square)
);
When('Alice erases {string}', (w, square: string) => edit(w, 'erase', square));

When('Alice reopens the app', async (w) => {
  await w.run.apply(reopenContentDevice, ALICE);
});
When('Alice undoes her last draft edit', async (w) => {
  await w.run.apply(undoDraftEditInBuilder, ALICE);
});
When('Alice redoes her last draft edit', async (w) => {
  await w.run.apply(redoDraftEditInBuilder, ALICE);
});

Then("Alice's board is laid out as:", async (w, table: LayoutTable) => {
  expect(boardWords(await w.run.read(builtDefinition))).toEqual(
    tableWords(table)
  );
});

Then("Alice's board is unchanged", async (w) => {
  expect(await w.run.read(builtDefinition)).toBe(
    await w.run.read(boardBeforeEdit)
  );
});

async function size(w: World) {
  const board = decodeSokobanBoard(await w.run.read(builtDefinition));
  return board.valid
    ? { columns: board.value.width, rows: board.value.height }
    : null;
}

Then(
  "Alice's board has {int} columns and {int} rows",
  async (w, columns: number, rows: number) => {
    expect(await size(w)).toEqual({ columns, rows });
  }
);
Then(
  "Alice's board still has {int} columns and {int} rows",
  async (w, columns: number, rows: number) => {
    expect(await size(w)).toEqual({ columns, rows });
  }
);

const refusedWith = async (w: World, code: string) =>
  expect((await w.run.read(builderSays)).refusal).toBe(code);
const corrects = async (w: World, code: string) =>
  expect((await w.run.read(builderSays)).corrections).toContain(code);

Then('Alice is told a board has at most 20 columns and 20 rows', (w) =>
  refusedWith(w, 'board_too_large')
);
Then('Alice is told the worker and crates stand only on floor or goals', (w) =>
  refusedWith(w, 'not_standable')
);
Then('Alice is told that square already has a piece', (w) =>
  refusedWith(w, 'occupied')
);
Then('Alice is told there is no crate on that square', (w) =>
  refusedWith(w, 'no_crate')
);
Then('Alice is told the board needs a worker', (w) =>
  corrects(w, 'needs_worker')
);
Then('Alice is told the board needs at least one crate', (w) =>
  corrects(w, 'needs_crate')
);
Then('Alice is told the board needs as many crates as goals', (w) =>
  corrects(w, 'crate_goal_mismatch')
);
Then("Alice's board has nothing to correct", async (w) => {
  expect(await w.run.read(builderSays)).toMatchObject({
    ready: true,
    corrections: [],
  });
});

Then(
  'Alice is told the smaller board removed:',
  async (w, table: LayoutTable) => {
    expect((await w.run.read(builderSays)).removed).toBe(
      table.map(([kind, square]) => `${kind} ${square}`).join(',')
    );
  }
);

Then(
  "the preview of Alice's board is laid out as:",
  async (w, table: LayoutTable) => {
    expect(await w.run.read(previewWords)).toEqual(tableWords(table));
  }
);

const offered = (w: World) => w.run.read(offeredDraftEdits, ALICE);
Then('Alice is offered undo but no redo for her draft', async (w) => {
  expect(await offered(w)).toEqual({ undo: true, redo: false });
});
Then('Alice is offered redo but no undo for her draft', async (w) => {
  expect(await offered(w)).toEqual({ undo: false, redo: true });
});
Then('Alice is not offered undo or redo for her draft', async (w) => {
  expect(await offered(w)).toEqual({ undo: false, redo: false });
});
Then('Alice cannot redo the replaced draft edit', async (w) => {
  expect((await offered(w)).redo).toBe(false);
});
