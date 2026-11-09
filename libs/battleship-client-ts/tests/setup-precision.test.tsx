import { expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client-ts/battleship-setup-board';
import { acceptFleet } from '@libs/battleship-shared-ts/battleship-fleet';
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
  await user.click(screen.getByRole('button', { name: /^Ship to place:/ }));
  await user.click(
    screen.getByRole('option', { name: 'Destroyer · G3, down' })
  );
  await user.click(screen.getByRole('button', { name: 'F–J / 6–10' }));
  await user.click(byTestId('setup-precision-cell-i7'));
  expect(fleet()).toContain('destroyer@i7v');
  expect(byTestId('setup-progress').textContent).toContain(
    'All five ships placed'
  );
  expect(byTestId('setup-cell-i8').getAttribute('aria-label')).toBe(
    'I8: Destroyer'
  );
});

test('overlap recovery stays in the placement workspace with ship, direction and region', async () => {
  // regression: battleship-placement-recovery-travel
  const [fleet, setFleet] = createSignal('fleet:carrier@a1h');
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
  await user.click(byTestId('setup-precision-cell-a1'));
  expect(fleet()).toBe('fleet:carrier@a1h');
  const workspace = byTestId('setup-precision').closest(
    '[data-component="BattleshipPlacementLayout"]'
  );
  const refusal = byTestId('setup-refusal');
  expect(workspace?.contains(refusal)).toBe(true);
  expect(workspace?.contains(byTestId('setup-rotate'))).toBe(true);
  expect(
    workspace?.contains(screen.getByRole('button', { name: /^Ship to place:/ }))
  ).toBe(true);
  expect(
    workspace?.contains(screen.getByRole('button', { name: 'A–E / 1–5' }))
  ).toBe(true);
  expect(refusal.getAttribute('role')).toBe('alert');
  expect(refusal.textContent).toContain('overlap the Carrier');
  await user.click(byTestId('setup-rotate'));
  await user.click(byTestId('setup-precision-cell-a3'));
  expect(fleet()).toBe('fleet:carrier@a1h;battleship@a3v');
  expect(screen.queryByTestId('setup-refusal')).toBeNull();
});

test('a phone opens comfortable placement without a mode discovery step', () => {
  // regression: battleship-phone-placement-default
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  try {
    renderBoard(() => (
      <SurfaceStackProvider>
        <BattleshipSetupBoard
          setup=""
          side="white"
          locked={false}
          testId="setup"
          onChange={() => undefined}
        />
      </SurfaceStackProvider>
    ));
    expect(screen.queryByTestId('setup-precision-cell-a1')).not.toBeNull();
    expect(byTestId('setup-grid').closest('[inert]')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /^Ship to place:/ }).textContent
    ).toContain('Carrier');
  } finally {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  }
});

test('comfortable placement validates a complete fleet across four regions with keyboard recovery', async () => {
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
  const region = async (name: string) => {
    await user.click(screen.getByRole('button', { name }));
  };
  byTestId('setup-precision-cell-a1').focus();
  await user.keyboard('{Enter}{Enter}');
  expect(fleet()).toBe('fleet:carrier@a1h');
  expect(byTestId('setup-refusal').textContent).toContain('overlap');
  await user.keyboard('r{ArrowDown}{ArrowDown}{Enter}');
  expect(fleet()).toContain('battleship@a3v');
  await region('F–J / 1–5');
  await user.click(byTestId('setup-precision-cell-g2'));
  await region('A–E / 6–10');
  await user.click(byTestId('setup-rotate'));
  await user.click(byTestId('setup-precision-cell-b8'));
  await region('F–J / 6–10');
  await user.click(byTestId('setup-precision-cell-i7'));
  expect(fleet()).toBe(
    'fleet:carrier@a1h;battleship@a3v;cruiser@g2v;submarine@b8h;destroyer@i7h'
  );
  expect(acceptFleet(fleet())).toBe(fleet());
  expect(byTestId('setup-progress').textContent).toContain(
    'All five ships placed'
  );
});

// regression: battleship-locked-fleet-blocks-inspection
test('locked comfortable placement permits inspection while refusing editing', async () => {
  const changes: string[] = [];
  renderBoard(() => (
    <SurfaceStackProvider>
      <BattleshipSetupBoard
        setup="fleet:carrier@a1h;battleship@a3v;cruiser@c3v;submarine@e3v;destroyer@i7v"
        side="white"
        locked
        testId="setup"
        onChange={(next) => changes.push(next)}
        initialPlacement="enlarged"
      />
    </SurfaceStackProvider>
  ));
  expect(byTestId('setup-locked').textContent).toContain('locked in');
  expect(document.body.textContent).not.toContain('Tap its first cell');
  expect(byTestId('setup-grid').querySelectorAll('[data-cell]').length).toBe(
    100
  );
  expect(
    screen.queryByRole('button', { name: /^Ship to place/ }) === null
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Rotate down' }) === null).toBe(
    true
  );
  expect(document.body.textContent).not.toContain('Place in');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'F–J / 6–10' }));
  expect(byTestId('setup-precision-cell-i8').getAttribute('aria-label')).toBe(
    'I8: Destroyer'
  );
  expect(
    screen.getByRole('group', { name: 'Enlarged fleet inspection' })
  ).toBeTruthy();
  await user.click(byTestId('setup-precision-cell-i8'));
  await user.keyboard('r{Enter}');
  await user.click(byTestId('setup-enlarge'));
  expect(screen.queryByTestId('setup-precision')).toBeNull();
  expect(byTestId('setup-cell-i8').getAttribute('aria-label')).toBe(
    'I8: Destroyer'
  );
  await user.click(byTestId('setup-enlarge'));
  expect(byTestId('setup-precision-cell-i8')).toBeTruthy();
  expect(changes).toEqual([]);
});

test('one spatial region press reveals F6 for the full named Battleship', async () => {
  // regression: battleship-round8-spatial-placement
  const [fleet, setFleet] = createSignal('fleet:carrier@a1h');
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
  expect(
    screen.getByRole('button', { name: /^Ship to place:/ }).textContent
  ).toContain('Battleship');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'F–J / 6–10' }));
  expect(byTestId('setup-area-3').getAttribute('aria-pressed')).toBe('true');
  await user.click(byTestId('setup-precision-cell-f6'));
  expect(fleet()).toBe('fleet:carrier@a1h;battleship@f6h');
});
