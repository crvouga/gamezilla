import { expect, test } from 'bun:test';
import { BattleshipTargetLayout } from '@pkgs/ui-root-client-ts/battleship-target-layout';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

test('coarse target areas select by keyboard and pointer without replacing field outcomes', async () => {
  const selected: number[] = [];
  renderUi(() => {
    const [area, setArea] = createSignal(0);
    return (
      <BattleshipTargetLayout
        precise
        region={area()}
        testId="layout"
        regions={['A1–E2', 'F1–J2']}
        onRegion={(n) => {
          selected.push(n);
          setArea(n);
        }}
        overview={<p>A1: miss</p>}
        working={<button type="button">Aim at B1</button>}
        controls={<button type="button">Map</button>}
      />
    );
  });
  const right = screen.getByRole('button', { name: 'F1–J2' });
  right.focus();
  await userEvent.setup({ delay: null }).keyboard('{Enter}');
  expect(selected).toEqual([1]);
  expect(right.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'A1–E2' }));
  expect(selected).toEqual([1, 0]);
  expect(screen.getByText('A1: miss')).toBeDefined();
  expect(
    screen.getByRole('button', { name: 'Aim at B1' }).closest('[inert]')
  ).toBeNull();
});
