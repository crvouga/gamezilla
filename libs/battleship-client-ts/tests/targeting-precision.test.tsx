import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

const fleet =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';

function mount(position = encodeBattleshipPosition([])) {
  const actions: string[] = [];
  renderBoard(() => (
    <SurfaceStackProvider>
      <BattleshipBoard
        position={position}
        orientation="white"
        interactive
        sound={false}
        syncKey={0}
        setup={fleet}
        hand={null}
        committed={[]}
        commitment={null}
        testId="precision"
        onAction={(cell) => actions.push(cell)}
      />
    </SurfaceStackProvider>
  ));
  return actions;
}

test('a mistaken edge target can be corrected before spending the shot', () => {
  // regression: battleship-touch-spends-mistarget
  // regression: battleship-confirmation-label-empty
  const actions = mount();
  fireEvent.click(byTestId('precision-target-j9'));
  expect(actions).toEqual([]);
  fireEvent.click(byTestId('precision-target-j10'));
  expect(byTestId('precision-fire').textContent).toContain('Fire at J10');
  fireEvent.click(byTestId('precision-view-own'));
  fireEvent.click(byTestId('precision-view-target'));
  expect(byTestId('precision-fire').textContent).toContain('Fire at J10');
  fireEvent.click(byTestId('precision-fire'));
  expect(actions).toEqual(['j10']);
});

test('keyboard selection previews a shot before confirmation', async () => {
  const actions = mount();
  const cell = byTestId('precision-aim-a1');
  cell.focus();
  const user = userEvent.setup({ delay: null });
  await user.keyboard('{Enter}');
  expect(actions).toEqual([]);
  expect(byTestId('precision-fire').textContent).toContain('Fire at A1');
  for (
    let step = 0;
    step < 6 && document.activeElement !== byTestId('precision-fire');
    step += 1
  )
    await user.tab();
  expect(document.activeElement).toBe(byTestId('precision-fire'));
  await user.keyboard('{Enter}');
  expect(actions).toEqual(['a1']);
});

// regression: battleship-aim-cleared-by-unchanged-position
test('a refreshed game record preserves the selected target when its position is unchanged', () => {
  const position = encodeBattleshipPosition([]);
  const [record, setRecord] = createSignal({ position, syncKey: 0 });
  const actions: string[] = [];
  renderBoard(() => (
    <BattleshipBoard
      position={record().position}
      orientation="white"
      interactive
      sound={false}
      syncKey={record().syncKey}
      setup={fleet}
      hand={null}
      committed={[]}
      commitment={null}
      testId="refresh"
      onAction={(cell) => actions.push(cell)}
    />
  ));
  fireEvent.click(byTestId('refresh-target-f10'));
  setRecord({ position, syncKey: 0 });
  expect(byTestId('refresh-fire').textContent).toContain('Fire at F10');
  fireEvent.click(byTestId('refresh-fire'));
  expect(actions).toEqual(['f10']);
  setRecord({ position, syncKey: 1 });
  expect(byTestId('refresh-fire').textContent).toContain('Choose a target');
});

test('large targeting areas partition all 100 cells and allow correction and cancellation', () => {
  // regression: battleship-large-targets-unavailable
  const actions = mount();
  const seen = new Set<string>();
  for (let area = 0; area < 10; area += 1) {
    fireEvent.click(byTestId(`precision-area-${area}`));
    const cells = byTestId('precision-aim-grid').querySelectorAll('button');
    expect(cells.length).toBe(10);
    for (const cell of cells) seen.add(cell.getAttribute('data-testid') ?? '');
  }
  expect(seen.size).toBe(100);
  fireEvent.click(byTestId('precision-target-j9'));
  fireEvent.click(byTestId('precision-target-j10'));
  expect(actions).toEqual([]);
  fireEvent.click(byTestId('precision-cancel-aim'));
  expect(byTestId('precision-fire').hasAttribute('disabled')).toBe(true);
  fireEvent.click(byTestId('precision-target-j10'));
  fireEvent.click(byTestId('precision-fire'));
  expect(actions).toEqual(['j10']);
});

// regression: battleship-target-confirmation-competes-with-navigation
test('J10 confirmation is the only primary action and stays beside Cancel', () => {
  mount();
  fireEvent.click(byTestId('precision-target-j10'));
  const fire = byTestId('precision-fire');
  const cancel = byTestId('precision-cancel-aim');
  expect(fire.getAttribute('data-face')).toBe('primary');
  expect(cancel.getAttribute('data-face')).toBe('neutral-ghost');
  expect(cancel.parentElement).toBe(fire.parentElement);
  expect(byTestId('precision-large-targets').getAttribute('data-face')).toBe(
    'neutral-outline'
  );
});

// regression: battleship-enlargement-loses-aim-context
test('enlarging J10 opens its region and returning to all waters preserves the aim', () => {
  const actions = mount(
    encodeBattleshipPosition([
      'a1:hit',
      'e5:miss',
      'b1:sunk:destroyer',
      'c3:hit',
    ])
  );
  fireEvent.click(byTestId('precision-large-targets'));
  fireEvent.click(byTestId('precision-target-j10'));
  fireEvent.click(byTestId('precision-large-targets'));
  expect(byTestId('precision-area-9').getAttribute('aria-pressed')).toBe(
    'true'
  );
  expect(byTestId('precision-target-j10').getAttribute('data-emphasis')).toBe(
    'recent'
  );
  fireEvent.click(byTestId('precision-large-targets'));
  expect(
    byTestId('precision-target-grid').querySelectorAll('button').length
  ).toBe(100);
  expect(byTestId('precision-fire').textContent).toContain('Fire at J10');
  expect(byTestId('precision-target-b1').getAttribute('aria-label')).toBe(
    'B1: hit, sunk Destroyer, latest shot'
  );
  expect(actions).toEqual([]);
});
