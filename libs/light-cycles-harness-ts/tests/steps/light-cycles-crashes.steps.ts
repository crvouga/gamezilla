import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness-ts/define';
import {
  cellName,
  type LightCyclesRiderName,
  lightCyclesBoardShown,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import { riderShown } from '@libs/light-cycles-harness-ts/light-cycles-reads';
import { placeLightCyclesArena } from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';

/** What the board shows at this step: well inside one 100 ms step. */
const THIS_STEP_MS = 50;

Given(
  "{lightCyclesRider}'s trail covers column {int}, row {int}",
  (w, rider: LightCyclesRiderName, column: number, row: number) =>
    w.s.apply(placeLightCyclesArena, { trails: { [rider]: [{ column, row }] } })
);
Given(
  '{lightCyclesRider} has crashed with its trail covering column {int}, row {int}',
  (w, rider: LightCyclesRiderName, column: number, row: number) =>
    w.s.apply(placeLightCyclesArena, {
      placed: { [rider]: { column, row, heading: 'up', riding: false } },
    })
);
Given(
  '{lightCyclesRider} has crashed at column {int}, row {int}',
  (w, rider: LightCyclesRiderName, column: number, row: number) =>
    w.s.apply(placeLightCyclesArena, {
      placed: { [rider]: { column, row, heading: 'up', riding: false } },
    })
);

Then(
  '{lightCyclesRider} has crashed and is still at column {int}, row {int}',
  async (w, rider: LightCyclesRiderName, column: number, row: number) => {
    const shown = await w.s.until((s) => riderShown(s, rider), {
      maxMs: THIS_STEP_MS,
      pred: (seen) => !seen.riding,
    });
    expect(shown).toMatchObject({ riding: false, column, row });
  }
);
Then(
  '{lightCyclesRiders} have all crashed',
  async (w, riders: LightCyclesRiderName[]) => {
    for (const rider of riders)
      expect((await w.s.read(riderShown, rider)).riding).toBe(false);
  }
);
Then(
  '{lightCyclesRiders} are still riding',
  async (w, riders: LightCyclesRiderName[]) => {
    for (const rider of riders)
      expect((await w.s.read(riderShown, rider)).riding).toBe(true);
  }
);
Then(
  'the cell at column {int}, row {int} is still empty',
  async (w, column: number, row: number) => {
    const board = await w.s.read(lightCyclesBoardShown, 'alice');
    const cell = cellName({ column, row });
    expect(board.riders.flatMap((rider) => rider.trail)).not.toContain(cell);
  }
);
Then(
  '{lightCyclesRider} is still at column {int}, row {int} with its trail on the arena',
  async (w, rider: LightCyclesRiderName, column: number, row: number) => {
    const shown = await w.s.read(riderShown, rider);
    expect(shown).toMatchObject({ riding: false, column, row });
    expect(shown.trail).toContain(cellName({ column, row }));
  }
);
