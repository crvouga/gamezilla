import { expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client-ts/battleship-setup-board';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

// regression: battleship-ship-picker-label-in-name
test('ship picker names its purpose and whole visible selection through placement', async () => {
  const [fleet, setFleet] = createSignal('');
  renderBoard(() => (
    <SurfaceStackProvider>
      <BattleshipSetupBoard
        setup={fleet()}
        side="white"
        locked={false}
        testId="setup"
        onChange={setFleet}
        initialPlacement="enlarged"
      />
    </SurfaceStackProvider>
  ));
  const user = userEvent.setup();
  const assertName = (label: string) => {
    const trigger = byTestId('setup-ship-picker');
    expect(trigger.textContent).toBe(label);
    expect(trigger).toHaveAccessibleName(`Ship to place: ${label}`);
  };
  assertName('Carrier · 5');
  await user.click(byTestId('setup-precision-cell-a1'));
  assertName('Battleship · 4');
  await user.click(byTestId('setup-ship-picker'));
  await user.click(
    screen.getByRole('option', { name: 'Carrier · A1, across' })
  );
  assertName('Carrier · A1, across');
  await user.click(byTestId('setup-rotate'));
  assertName('Carrier · A1, down');
  await user.click(byTestId('setup-precision-cell-b1'));
  assertName('Battleship · 4');
  await user.click(byTestId('setup-ship-picker'));
  await user.click(screen.getByRole('option', { name: 'Carrier · B1, down' }));
  assertName('Carrier · B1, down');
  setFleet(
    'fleet:carrier@a1h;battleship@a3v;cruiser@c3v;submarine@e3v;destroyer@g3v'
  );
  await user.click(byTestId('setup-ship-picker'));
  await user.click(
    screen.getByRole('option', { name: 'Carrier · A1, across' })
  );
  await user.click(byTestId('setup-precision-cell-a2'));
  assertName('Choose a ship to reposition');
});
