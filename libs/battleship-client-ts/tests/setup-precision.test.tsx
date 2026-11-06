import { expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client-ts/battleship-setup-board';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

test('a ready fleet can be repositioned in another enlarged region', async () => {
  // regression: battleship-placement-unlabeled-complete-selection
  const [fleet, setFleet] = createSignal(
    'fleet:carrier@a1h;battleship@a3v;cruiser@c3v;submarine@e3v;destroyer@g3v'
  );
  renderBoard(() => (
    <SurfaceStackProvider>
      <BattleshipSetupBoard
        setup={fleet()}
        side="white"
        locked={false}
        testId="setup"
        onChange={setFleet}
      />
    </SurfaceStackProvider>
  ));
  const user = userEvent.setup();
  await user.click(byTestId('setup-enlarge'));
  await user.click(screen.getByRole('button', { name: 'Ship to place' }));
  await user.click(
    screen.getByRole('option', { name: 'Destroyer · G3, down' })
  );
  await user.click(screen.getByRole('button', { name: 'Placement area' }));
  await user.click(screen.getByRole('option', { name: 'F–J / 6–10' }));
  await user.click(byTestId('setup-precision-cell-i7'));
  expect(fleet()).toContain('destroyer@i7v');
  expect(byTestId('setup-progress').textContent).toContain(
    'All five ships placed'
  );
  expect(byTestId('setup-cell-i8').getAttribute('aria-label')).toBe(
    'I8: Destroyer'
  );
});
