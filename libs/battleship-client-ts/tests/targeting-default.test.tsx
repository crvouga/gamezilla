import { expect, test } from 'bun:test';
import { BattleshipTargetGrid } from '@libs/battleship-client-ts/battleship-target-grid';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

// regression: battleship-default-precision-loses-whole-field
test('default precise aiming keeps all 100 outcomes and changes regions without spending a shot', () => {
  const aims: string[] = [];
  const cells = Array.from({ length: 100 }, (_, n) => ({
    id: `${String.fromCharCode(97 + (n % 10))}${Math.floor(n / 10) + 1}`,
    glyph: n === 0 ? '○' : '',
    label: n === 0 ? 'A1: miss' : 'Untried',
    tone: 'open' as const,
    enabled: n !== 0,
  }));
  renderBoard(() => {
    const [selected, setSelected] = createSignal<string | null>(null);
    return (
      <BattleshipTargetGrid
        label="Targeting"
        testId="precise"
        cells={cells}
        selected={selected()}
        onAim={(cell) => {
          aims.push(cell);
          setSelected(cell);
        }}
      />
    );
  });
  expect(
    byTestId('precise-target-grid').querySelectorAll('[data-cell]')
  ).toHaveLength(100);
  expect(
    byTestId('precise-aim-grid').querySelectorAll('[data-cell]')
  ).toHaveLength(10);
  fireEvent.click(byTestId('precise-aim-a1'));
  expect(aims).toEqual([]);
  fireEvent.click(byTestId('precise-aim-b1'));
  fireEvent.click(byTestId('precise-area-9'));
  expect(aims).toEqual(['b1']);
  expect(byTestId('precise-target-a1').getAttribute('aria-label')).toBe(
    'A1: miss'
  );
  fireEvent.click(byTestId('precise-aim-j10'));
  expect(aims).toEqual(['b1', 'j10']);
  fireEvent.click(byTestId('precise-area-0'));
  expect(byTestId('precise-aim-b1')).toBeDefined();
});
