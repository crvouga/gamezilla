import { expect, test } from 'bun:test';
import { shotGridCells } from '@libs/battleship-client-ts/battleship-grid-cells';
import { BattleshipTargetGrid } from '@libs/battleship-client-ts/battleship-target-grid';
import userEvent from '@testing-library/user-event';
import { byTestId, renderBoard } from './render';

// regression: battleship-region-repeats-full-board-filter
test('opening F9–J10 reads the source board once per region update', async () => {
  const cells = shotGridCells({ shots: [], interactive: true, aiming: null });
  let sourceReads = 0;
  const readCells = () => {
    sourceReads += 1;
    return cells;
  };
  renderBoard(() => (
    <BattleshipTargetGrid
      label="Targeting"
      testId="workload"
      cells={readCells()}
      onAim={() => {}}
    />
  ));
  sourceReads = 0;
  await userEvent.setup().click(byTestId('workload-area-9'));
  expect(byTestId('workload-aim-j10').getAttribute('aria-label')).toBe(
    'Fire at J10'
  );
  expect(sourceReads).toBeLessThanOrEqual(2);
});
