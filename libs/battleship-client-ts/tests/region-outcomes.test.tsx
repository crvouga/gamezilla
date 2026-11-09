import { expect, test } from 'bun:test';
import { shotGridCells } from '@libs/battleship-client-ts/battleship-grid-cells';
import { BattleshipTargetGrid } from '@libs/battleship-client-ts/battleship-target-grid';
import { screen } from '@solidjs/testing-library';
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
      inspect={false}
      onAim={() => {}}
    />
  ));
  expect(screen.getByRole('button', { description: 'A1: miss' })).toBe(
    byTestId('outcomes-area-0')
  );
  expect(
    screen.getByRole('button', {
      description:
        'F10: hit, sunk Destroyer; G10: hit, sunk Destroyer, latest shot',
    })
  ).toBe(byTestId('outcomes-area-9'));
  expect(
    screen.getAllByRole('button', { description: 'No shots in this region' })
  ).toContain(byTestId('outcomes-area-8'));
  expect(byTestId('outcomes-area-0').getAttribute('aria-pressed')).toBe('true');
  setCells(
    shotGridCells({
      shots: [{ cell: 'j10', outcome: 'miss' }],
      interactive: false,
      aiming: null,
    })
  );
  expect(
    screen.getByRole('button', { description: 'J10: miss, latest shot' })
  ).toBe(byTestId('outcomes-area-9'));
});

// regression: battleship-region-description-unsupported-aria
test('region outcomes use a linked accessible description', () => {
  renderBoard(() => (
    <BattleshipTargetGrid
      label="Targeting"
      testId="linked-outcomes"
      cells={shotGridCells({
        shots: [{ cell: 'a1', outcome: 'miss' }],
        interactive: true,
        aiming: null,
      })}
      onAim={() => {}}
    />
  ));
  const region = byTestId('linked-outcomes-area-0');
  const descriptionId = region.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  expect(document.getElementById(descriptionId ?? '')?.textContent).toBe(
    'A1: miss, latest shot'
  );
  expect(
    screen.getByRole('button', { description: 'A1: miss, latest shot' })
  ).toBe(region);
});
