/**
 * Shots, turns, sinkings and the victory, and what each player's boards
 * show of them.
 */

import { expect } from 'bun:test';
import { shootBattleship } from '@libs/battleship-harness-ts/battleship-actions';
import {
  answeredShots,
  BLUE_SHIP_CELLS,
  BLUE_VICTORY,
  RED_FLEET_DESTROYER_C3,
  RED_SHIP_CELLS,
} from '@libs/battleship-harness-ts/battleship-fixtures';
import {
  type BattleshipBoardShown,
  type BattleshipView,
  shipCells,
  shotCells,
} from '@libs/battleship-harness-ts/battleship-view';
import { SHIP_IDS } from '@libs/battleship-shared-ts/battleship-board';
import { partition } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  type BattleshipWorld,
  cellNamed,
  cellsNamed,
  remember,
  remembered,
  sees,
  seesOnce,
  setupBattleship,
  shipNamed,
  sideOf,
} from './battleship-world';

/** How long a person waits to be sure a shot has not reached them. */
const OFFLINE_WAIT_MS = 5000;

/**
 * The space's host, who creates the game: a space plays only while its host
 * is connected, so a player who loses the connection is never the host.
 */
const SPACE_HOST = 'carol';

const MARKS = { hit: ['hit', 'sunk'], miss: ['miss'] } as const;

/** Shots made in turn from the current position, each by whoever has the turn. */
async function shots(w: BattleshipWorld, cells: readonly string[]) {
  for (const cell of cells) {
    const turn = (await sees(w, 'alice')).screen.current?.turn;
    await w.s.apply(shootBattleship, turn === 'white' ? 'alice' : 'bob', cell);
  }
  await remember(w);
}

/** The ships a board names sunk, and every marked cell, in board order. */
function marked(board: BattleshipBoardShown) {
  return shotCells(board).map((cell) => ({
    cell,
    mark: board[cell]!.mark,
    ship: board[cell]!.ship,
  }));
}

function shotSeen(view: BattleshipView, board: 'own' | 'target', cell: string) {
  return view[board][cell]?.mark ?? 'open';
}

Given(
  "{actor} and {actor} have started Battleship with {actor}'s destroyer on C3 and C4",
  async (w) =>
    setupBattleship(w, {
      host: SPACE_HOST,
      fleets: { second: RED_FLEET_DESTROYER_C3 },
    })
);
Given('{actor} and {actor} have started Battleship', async (w) =>
  setupBattleship(w, { host: SPACE_HOST })
);
Given(
  '{actor} has hit/missed {word}',
  async (w, _actor: string, cell: string) => shots(w, [cellNamed(cell)])
);
Given(
  '{actor} has hit/missed {word} and {actor} has shot in reply',
  async (w, _actor: string, cell: string) =>
    shots(w, answeredShots([cellNamed(cell)]))
);
Given(
  '{actor} has missed {word} and hit {word}, and {actor} has shot in reply to each',
  async (w, _actor: string, miss: string, hit: string) =>
    shots(w, answeredShots([cellNamed(miss), cellNamed(hit)]))
);
Given(
  "{actor} has hit all but the last cell of {actor}'s {word}",
  async (w, _actor: string, _owner: string, ship: string) =>
    shots(w, answeredShots(RED_SHIP_CELLS[shipNamed(ship)].slice(0, -1)))
);
Given(
  "{actor} has hit one cell of {actor}'s {word}",
  async (w, _actor: string, _owner: string, ship: string) =>
    shots(w, answeredShots(RED_SHIP_CELLS[shipNamed(ship)].slice(0, 1)))
);
Given(
  "{actor} has sunk {int} of {actor}'s ships and hit one cell of his destroyer",
  async (w, _actor: string, sunk: number) =>
    shots(
      w,
      answeredShots([
        ...SHIP_IDS.slice(0, sunk).flatMap((ship) => RED_SHIP_CELLS[ship]),
        RED_SHIP_CELLS.destroyer[0],
      ])
    )
);
Given('{actor} has won Battleship against {actor}', async (w) =>
  shots(w, BLUE_VICTORY)
);
Given("{actor}'s phone is offline", async (w, actor: string) => {
  await w.s.apply(partition, actor);
});
Given(
  "{actor}'s phone was offline when {actor} shot at {word}",
  async (w, actor: string, shooter: string, cell: string) => {
    await w.s.apply(partition, actor);
    await w.s.apply(shootBattleship, shooter, cellNamed(cell));
  }
);

When('{actor} shoots at {word}', async (w, actor: string, cell: string) => {
  await w.s.apply(shootBattleship, actor, cellNamed(cell));
});
When(
  "{actor} shoots at the last cell of {actor}'s {word}",
  async (w, actor: string, _owner: string, ship: string) => {
    await w.s.apply(
      shootBattleship,
      actor,
      RED_SHIP_CELLS[shipNamed(ship)].at(-1)!
    );
  }
);
When(
  "{actor} shoots at a second cell of {actor}'s {word}",
  async (w, actor: string, _owner: string, ship: string) => {
    await w.s.apply(
      shootBattleship,
      actor,
      RED_SHIP_CELLS[shipNamed(ship)][1]!
    );
  }
);

Then(
  '{actor} and {actor} see the shot at {word} is a {word}',
  async (
    w,
    ...[shooter, owner, cell, result]: [string, string, string, string]
  ) => {
    const at = cellNamed(cell);
    const marks: readonly string[] = MARKS[result as keyof typeof MARKS];
    expect(marks).toBeDefined();
    const shooterSaw = await seesOnce(w, shooter, (v) =>
      marks.includes(shotSeen(v, 'target', at))
    );
    const ownerSaw = await seesOnce(w, owner, (v) =>
      marks.includes(shotSeen(v, 'own', at))
    );
    expect(marks).toContain(shotSeen(shooterSaw, 'target', at));
    expect(marks).toContain(shotSeen(ownerSaw, 'own', at));
  }
);
Then('{actor} has the Battleship turn', async (w, actor: string) => {
  const side = await sideOf(w, actor);
  const view = await seesOnce(w, actor, (v) => v.screen.current?.turn === side);
  expect(view.screen.current?.status).toBe('active');
  expect(view.screen.current?.turn).toBe(side);
});
Then(
  "{actor} is told it is the other player's turn",
  async (w, actor: string) => {
    expect((await sees(w, actor)).screen.error).toBe(
      'only the participant to move may play'
    );
  }
);
Then(
  '{actor} is told she has already shot at {word}',
  async (w, actor: string) => {
    expect((await sees(w, actor)).screen.error).toBe('move is illegal');
  }
);
Then('{actor} is told the game is over', async (w, actor: string) => {
  expect((await sees(w, actor)).screen.error).toBe('finished');
});
Then(
  '{actor} is told shooting begins once the game starts',
  async (w, actor: string) => {
    expect((await sees(w, actor)).screen.error).toBe('not started');
  }
);
Then('the Battleship boards and turn are unchanged', async (w) => {
  for (const player of ['alice', 'bob']) {
    const before = remembered(w, player);
    const now = await sees(w, player);
    expect(now.screen.current?.turn).toBe(before.screen.current?.turn);
    expect(now.screen.current?.moves).toEqual(before.screen.current?.moves);
    expect(marked(now.own)).toEqual(marked(before.own));
    expect(marked(now.target)).toEqual(marked(before.target));
  }
});
Then("{actor}'s targeting board is empty", async (w, actor: string) => {
  const view = await sees(w, actor);
  expect(shotCells(view.target)).toEqual([]);
  expect(view.screen.current?.moves).toEqual([]);
});
Then(
  "{actor}'s own board shows {actor}'s shot at {word}",
  async (w, actor: string, _shooter: string, cell: string) => {
    const at = cellNamed(cell);
    await seesOnce(w, actor, (v) => shotCells(v.own).includes(at));
  }
);
Then(
  "{actor}'s own board does not show {actor}'s shot at {word}",
  async (w, actor: string, _shooter: string, cell: string) => {
    const at = cellNamed(cell);
    // The shot reaches every connected device well within this wait.
    await w.s.advanceTime(OFFLINE_WAIT_MS);
    expect(shotCells((await sees(w, actor)).own)).not.toContain(at);
  }
);
Then(
  "{actor}'s own board shows all five of her ships",
  async (w, actor: string) => {
    const own = (await sees(w, actor)).own;
    for (const ship of SHIP_IDS)
      expect(shipCells(own, ship)).toEqual([...BLUE_SHIP_CELLS[ship]]);
  }
);
Then(
  "{actor}'s targeting board shows only a miss at {word}",
  async (w, actor: string, cell: string) => {
    expect(marked((await sees(w, actor)).target)).toEqual([
      { cell: cellNamed(cell), mark: 'miss', ship: null },
    ]);
  }
);
Then(
  "{actor}'s targeting board (still )shows only a hit at {word}, naming no ship",
  async (w, actor: string, cell: string) => {
    expect(marked((await sees(w, actor)).target)).toEqual([
      { cell: cellNamed(cell), mark: 'hit', ship: null },
    ]);
  }
);
Then(
  "{actor}'s targeting board shows only {actor}'s sunk {word} on {}",
  async (w, ...[actor, , ship, cells]: [string, string, string, string]) => {
    expect(marked((await sees(w, actor)).target)).toEqual(
      cellsNamed(cells).map((cell) => ({
        cell,
        mark: 'sunk',
        ship: shipNamed(ship),
      }))
    );
  }
);
Then(
  "{actor} and {actor} see {actor}'s {word} is sunk",
  async (w, ...[shooter, owner, , ship]: [string, string, string, string]) => {
    const cells: readonly string[] = RED_SHIP_CELLS[shipNamed(ship)];
    const sunk = (board: BattleshipBoardShown) =>
      cells.every(
        (cell) => board[cell]?.mark === 'sunk' && board[cell]?.ship === ship
      );
    await seesOnce(w, shooter, (v) => sunk(v.target));
    await seesOnce(w, owner, (v) => sunk(v.own));
  }
);
Then(
  '{actor} and {actor} see a hit with no ship sunk',
  async (w, shooter: string, owner: string) => {
    const last = (await sees(w, shooter)).screen.current?.moves.at(-1)?.uci;
    if (last === undefined) throw new Error('No shot was made');
    const cell = last.split(':')[0]!;
    const shooterSaw = await seesOnce(
      w,
      shooter,
      (v) => v.target[cell]?.mark === 'hit'
    );
    const ownerSaw = await seesOnce(
      w,
      owner,
      (v) => v.own[cell]?.mark === 'hit'
    );
    expect(marked(shooterSaw.target).some((m) => m.mark === 'sunk')).toBe(
      false
    );
    expect(marked(ownerSaw.own).some((m) => m.mark === 'sunk')).toBe(false);
  }
);
Then(
  "{actor}'s {word} is still afloat",
  async (w, owner: string, ship: string) => {
    const own = (await sees(w, owner)).own;
    const cells = shipCells(own, shipNamed(ship));
    expect(cells).not.toEqual([]);
    expect(cells.some((cell) => own[cell]?.mark !== 'hit')).toBe(true);
    expect(cells.every((cell) => own[cell]?.mark !== 'sunk')).toBe(true);
  }
);
Then('{actor} wins Battleship', async (w, actor: string) => {
  const side = await sideOf(w, actor);
  const view = await seesOnce(
    w,
    actor,
    (v) => v.screen.current?.status === 'completed'
  );
  expect(view.screen.current?.outcome).toStartWith(`${side} wins`);
});
Then(
  '{actor} and {actor} see the game is over',
  async (w, first: string, second: string) => {
    for (const player of [first, second])
      await seesOnce(
        w,
        player,
        (v) => v.screen.current?.status === 'completed'
      );
  }
);
Then('Battleship still has no winner', async (w) => {
  for (const player of ['alice', 'bob']) {
    const game = (await sees(w, player)).screen.current;
    expect(game?.status).toBe('active');
    expect(game?.outcome).toBe('');
  }
});
