import { expect } from 'bun:test';
import { packProgressOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import type { LayoutTable } from '@libs/sokoban-harness-ts/sokoban-layout';
import {
  completeSokobanPuzzle,
  moveSokobanWorker,
  playedPosition,
  playOwnSokobanBoard,
  playSokobanPackPuzzle,
  redoSokobanMove,
  restartSokobanPuzzle,
  shownPlay,
  toldOnScreen,
  undoSokobanMove,
} from '@libs/sokoban-harness-ts/sokoban-play';
import {
  deviceLibrary,
  devicePlay,
} from '@libs/sokoban-harness-ts/sokoban-screen';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  type Cell,
  parseSquareName,
  type SokobanDirection,
  sameCell,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Given, Then, When } from './world';

const BOB = 'bob:phone';

function square(name: string): Cell {
  const cell = parseSquareName(name);
  if (cell === null) throw new Error(`Not a square: ${name}`);
  return cell;
}

function directions(text: string): readonly SokobanDirection[] {
  return text.split(', ').map((word) => {
    if (word !== 'up' && word !== 'down' && word !== 'left' && word !== 'right')
      throw new Error(`Not a direction: ${word}`);
    return word;
  });
}

async function moveAll(
  w: Parameters<Parameters<typeof Given>[1]>[0],
  text: string
): Promise<void> {
  for (const direction of directions(text))
    await w.run.apply(moveSokobanWorker, BOB, direction);
}

Given(
  'Bob is playing a Sokoban puzzle laid out as:',
  async (w, table: LayoutTable) => {
    await w.run.apply(playOwnSokobanBoard, BOB, table);
  }
);

When(
  'Bob opens a Sokoban puzzle laid out as:',
  async (w, table: LayoutTable) => {
    await w.run.apply(playOwnSokobanBoard, BOB, table);
  }
);

Given(
  'Bob is playing {string} in the published pack {string} containing {string}, laid out as:',
  async (
    w,
    ...[title, pack, titles, table]: [string, string, string, LayoutTable]
  ) => {
    await w.run.apply(playSokobanPackPuzzle, { title, pack, titles, table });
  }
);

Given('Bob has moved the worker {string}', async (w, moves: string) => {
  await moveAll(w, moves);
});

Given(
  'Bob has moved the worker {string} and undone his last move',
  async (w, moves: string) => {
    await moveAll(w, moves);
    await w.run.apply(undoSokobanMove, BOB);
  }
);

Given(
  'Bob has moved the worker {string}, undone his last move and then moved the worker {string}',
  async (w, first: string, then: string) => {
    await moveAll(w, first);
    await w.run.apply(undoSokobanMove, BOB);
    await moveAll(w, then);
  }
);

When('Bob moves the worker {word}', async (w, direction: string) => {
  await moveAll(w, direction);
});

When('Bob undoes his last move', async (w) => {
  await w.run.apply(undoSokobanMove, BOB);
});

When('Bob redoes his last move', async (w) => {
  await w.run.apply(redoSokobanMove, BOB);
});

When('Bob restarts the Sokoban puzzle', async (w) => {
  await w.run.apply(restartSokobanPuzzle, BOB);
});

When('Bob completes that puzzle', async (w) => {
  await w.run.apply(completeSokobanPuzzle, BOB);
});

async function workerOn(
  w: Parameters<Parameters<typeof Then>[1]>[0],
  name: string
): Promise<boolean> {
  const played = await w.run.read(playedPosition, BOB);
  return played !== null && sameCell(played.position.worker, square(name));
}

Then('the worker stands on {string}', async (w, name: string) => {
  expect(await workerOn(w, name)).toBe(true);
});

Then('the worker still stands on {string}', async (w, name: string) => {
  expect(await workerOn(w, name)).toBe(true);
});

async function crateOn(
  w: Parameters<Parameters<typeof Then>[1]>[0],
  name: string
): Promise<boolean> {
  const played = await w.run.read(playedPosition, BOB);
  return (
    played?.position.crates.some((crate) => sameCell(crate, square(name))) ??
    false
  );
}

Then('a crate stands on {string}', async (w, name: string) => {
  expect(await crateOn(w, name)).toBe(true);
});

Then('a crate still stands on {string}', async (w, name: string) => {
  expect(await crateOn(w, name)).toBe(true);
});

Then(
  'Bob sees {int} move(s) and {int} push(es)',
  async (w, moves: number, pushes: number) => {
    expect(await w.run.read(shownPlay, BOB)).toMatchObject({ moves, pushes });
  }
);

Then(
  'Bob still sees {int} move(s) and {int} push(es)',
  async (w, moves: number, pushes: number) => {
    expect(await w.run.read(shownPlay, BOB)).toMatchObject({ moves, pushes });
  }
);

Then("Bob is told the worker's way is blocked", async (w) => {
  expect(await w.run.read(toldOnScreen, BOB)).toBe('blocked');
});

Then('Bob is told that crate cannot move', async (w) => {
  expect(await w.run.read(toldOnScreen, BOB)).toBe('crate_blocked');
});

Then('Bob is told there is no earlier puzzle position', async (w) => {
  expect(await w.run.read(toldOnScreen, BOB)).toBe(
    'PUZZLE_NO_EARLIER_POSITION'
  );
});

Then('Bob is told there is no later puzzle position', async (w) => {
  expect(await w.run.read(toldOnScreen, BOB)).toBe('PUZZLE_NO_REDO');
});

Then('the Sokoban puzzle is complete', async (w) => {
  expect((await w.run.read(shownPlay, BOB)).complete).toBe(true);
});

Then('the Sokoban puzzle is unfinished', async (w) => {
  expect((await w.run.read(shownPlay, BOB)).complete).toBe(false);
});

Then(
  "Bob sees the puzzle's starting position with {int} moves and {int} pushes",
  async (w, moves: number, pushes: number) => {
    const played = await w.run.read(playedPosition, BOB);
    const board = decodeSokobanBoard(played?.definition ?? '');
    if (!board.valid) throw new Error('The played board is unreadable');
    expect(played?.position.worker ?? null).toEqual(board.value.worker);
    expect(played?.position.crates).toEqual(board.value.crates);
    expect(await w.run.read(shownPlay, BOB)).toMatchObject({ moves, pushes });
  }
);

Then(
  'Bob sees one completed puzzle out of two in {string}',
  async (w, pack: string) => {
    const progress = await w.run.until(
      (s) => packProgressOnDevice(s, BOB, pack),
      { pred: (value) => value?.completedCount === 1, maxMs: 5000 }
    );
    expect(progress).toMatchObject({ completedCount: 1, total: 2 });
  }
);

Then(
  "{string} remains completed in Bob's progress",
  async (w, title: string) => {
    const library = await w.run.read(deviceLibrary, BOB);
    const play = await w.run.read(devicePlay, BOB);
    const edition = library.revisions.find(
      (entry) => entry.kind === 'puzzle' && entry.title === title
    );
    expect(
      play.completions.some((entry) => entry.puzzle_revision_id === edition?.id)
    ).toBe(true);
  }
);
