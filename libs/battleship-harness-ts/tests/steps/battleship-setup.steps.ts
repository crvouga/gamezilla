/**
 * Placing a fleet, becoming ready and starting: the setup board's gestures,
 * the readiness and start controls, and what the person is told.
 */

import { expect } from 'bun:test';
import {
  askForRandomFleet,
  becomeBattleshipReady,
  placeBattleshipShip,
  rotateBattleshipShip,
  startBattleship,
} from '@libs/battleship-harness-ts/battleship-actions';
import {
  BLUE_FOUR_SHIPS,
  SHIP_LENGTHS,
} from '@libs/battleship-harness-ts/battleship-fixtures';
import {
  battleshipFleetLockedShown,
  battleshipSetupRefusal,
  battleshipSetupStatus,
  shipCells,
} from '@libs/battleship-harness-ts/battleship-view';
import { SHIP_IDS } from '@libs/battleship-shared-ts/battleship-board';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  cellNamed,
  cellsNamed,
  orientationNamed,
  remember,
  remembered,
  sees,
  setupPlacing,
  shipNamed,
  sideOf,
} from './battleship-world';

/** Who places which ship, which way, from which cell, as the scenario says it. */
type Placing = [actor: string, ship: string, direction: string, cell: string];

function placementNamed(ship: string, direction: string, cell: string) {
  return {
    ship: shipNamed(ship),
    cell: cellNamed(cell),
    orientation: orientationNamed(direction),
  };
}

async function readyWithRandomFleet(
  w: Parameters<typeof remember>[0],
  actor: string
): Promise<void> {
  await w.s.apply(askForRandomFleet, actor);
  await w.s.apply(becomeBattleshipReady, actor);
}

Given('{actor} is placing her Battleship fleet', async (w) => setupPlacing(w));
// The keyboard is the When's; the fleet is placed on the same board.
Given(
  '{actor} is placing her Battleship fleet with the keyboard alone',
  async (w) => setupPlacing(w)
);
Given(
  '{actor} has placed her {word} {word} from {word}',
  async (w, ...[actor, ship, direction, cell]: Placing) => {
    await w.s.apply(
      placeBattleshipShip,
      actor,
      placementNamed(ship, direction, cell)
    );
    await remember(w);
  }
);
Given(
  '{actor} has placed four of her/his five ships',
  async (w, actor: string) => {
    for (const { ship, bow, orientation } of BLUE_FOUR_SHIPS)
      await w.s.apply(placeBattleshipShip, actor, {
        ship,
        cell: bow,
        orientation,
      });
    await remember(w);
  }
);
Given('{actor} has a random fleet', async (w, actor: string) => {
  await w.s.apply(askForRandomFleet, actor);
  await remember(w);
});
Given(
  '{actor} is ready for the custom game with a random fleet',
  async (w, actor: string) => {
    await setupPlacing(w);
    await readyWithRandomFleet(w, actor);
    await remember(w);
  }
);
Given(
  '{actor} and {actor} are ready for the custom game with random fleets',
  async (w, first: string, second: string) => {
    await setupPlacing(w);
    await readyWithRandomFleet(w, first);
    await readyWithRandomFleet(w, second);
    await remember(w);
  }
);

When(
  '{actor} places her {word} {word} from {word}',
  async (w, ...[actor, ship, direction, cell]: Placing) => {
    await w.s.apply(
      placeBattleshipShip,
      actor,
      placementNamed(ship, direction, cell)
    );
  }
);
When(
  '{actor} places her {word} {word} from {word} with the keyboard',
  async (w, ...[actor, ship, direction, cell]: Placing) => {
    await w.s.apply(
      placeBattleshipShip,
      actor,
      placementNamed(ship, direction, cell),
      true
    );
  }
);
When('{actor} rotates her {word}', async (w, actor: string, ship: string) => {
  await w.s.apply(rotateBattleshipShip, actor, shipNamed(ship));
});
When('{actor} asks for a random fleet', async (w, actor: string) => {
  await w.s.apply(askForRandomFleet, actor);
});
When('{actor} becomes ready for the custom game', async (w, actor: string) => {
  await w.s.apply(becomeBattleshipReady, actor);
});
When('{actor} starts the custom game', async (w, actor: string) => {
  await w.s.apply(startBattleship, actor);
});

Then(
  "{actor}'s {word} (still )covers {}",
  async (w, actor: string, ship: string, cells: string) => {
    expect(shipCells((await sees(w, actor)).setup, shipNamed(ship))).toEqual(
      cellsNamed(cells)
    );
  }
);
Then(
  "{actor}'s {word} is not placed",
  async (w, actor: string, ship: string) => {
    expect(shipCells((await sees(w, actor)).setup, shipNamed(ship))).toEqual(
      []
    );
  }
);
Then(
  '{actor} is told the ship must fit inside the board',
  async (w, actor: string) => {
    expect(await w.s.read(battleshipSetupRefusal, actor)).toContain(
      'run off the board'
    );
  }
);
Then('{actor} is told ships cannot share a cell', async (w, actor: string) => {
  expect(await w.s.read(battleshipSetupRefusal, actor)).toContain('overlap');
});
Then(
  '{actor} is told her fleet cannot change while she is ready',
  async (w, actor: string) => {
    expect(await w.s.read(battleshipFleetLockedShown, actor)).toBe(true);
  }
);
Then("{actor}'s own board is unchanged", async (w, actor: string) => {
  expect((await sees(w, actor)).setup).toEqual(remembered(w, actor).setup);
});
Then('{actor} has a complete fleet', async (w, actor: string) => {
  expect(await w.s.read(battleshipSetupStatus, actor)).toBe(
    'Your private setup is complete.'
  );
  const board = (await sees(w, actor)).setup;
  for (const ship of SHIP_IDS) expect(shipCells(board, ship)).not.toEqual([]);
});
Then(
  "each of {actor}'s ships lies inside the board without sharing a cell",
  async (w, actor: string) => {
    const board = (await sees(w, actor)).setup;
    for (const ship of SHIP_IDS) {
      const cells = shipCells(board, ship);
      // Every cell names one ship, so a whole ship on the board shares none.
      expect(cells).toHaveLength(SHIP_LENGTHS[ship]);
      const columns = new Set(cells.map((cell) => cell[0]));
      const rows = new Set(cells.map((cell) => cell.slice(1)));
      expect(columns.size === 1 || rows.size === 1).toBe(true);
    }
  }
);
Then('{actor} is ready for the custom game', async (w, actor: string) => {
  const side = await sideOf(w, actor);
  expect((await sees(w, actor)).screen.current?.ready).toContain(side);
});
Then('{actor} is not ready for the custom game', async (w, actor: string) => {
  const side = await sideOf(w, actor);
  expect((await sees(w, actor)).screen.current?.ready).not.toContain(side);
});
Then('{actor} is told her fleet is incomplete', async (w, actor: string) => {
  expect(await w.s.read(battleshipSetupStatus, actor)).toBe(
    'Your private setup is incomplete.'
  );
});
Then(
  '{actor} is told the game needs a connection',
  async (w, actor: string) => {
    expect((await sees(w, actor)).screen.error).toBe('connection needed');
  }
);
Then('{actor} is told every person must be ready', async (w, actor: string) => {
  expect((await sees(w, actor)).screen.error).toBe(
    'every person must be ready'
  );
});
