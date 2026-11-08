import { expect, test } from 'bun:test';
import { shotGridCells } from '@libs/battleship-client-ts/battleship-grid-cells';
import { BattleshipTargetGrid } from '@libs/battleship-client-ts/battleship-target-grid';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

// regression: battleship-overview-hides-shot-outcomes
test('every region describes its shot outcomes without first changing the working area', () => {
  const [cells, setCells] = createSignal(
    shotGridCells({
      shots: [
        { cell: 'a1', outcome: 'miss' },
        { cell: 'f10', outcome: 'hit' },
        { cell: 'g10', outcome: 'sunk', ship: 'destroyer' },
      ],
      interactive: true,
      aiming: null,
    })
  );
  renderBoard(() => (
    <BattleshipTargetGrid
      label="Targeting"
      testId="outcomes"
      cells={cells()}
      onAim={() => {}}
    />
  ));
  expect(byTestId('outcomes-area-0').getAttribute('aria-description')).toBe(
    'A1: miss'
  );
  expect(byTestId('outcomes-area-9').getAttribute('aria-description')).toBe(
    'F10: hit, sunk Destroyer; G10: hit, sunk Destroyer, latest shot'
  );
  expect(byTestId('outcomes-area-8').getAttribute('aria-description')).toBe(
    'No shots in this region'
  );
  expect(byTestId('outcomes-area-0').getAttribute('aria-pressed')).toBe('true');
  setCells(
    shotGridCells({
      shots: [{ cell: 'j10', outcome: 'miss' }],
      interactive: false,
      aiming: null,
    })
  );
  expect(byTestId('outcomes-area-9').getAttribute('aria-description')).toBe(
    'J10: miss, latest shot'
  );
});
