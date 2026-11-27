import { expect, test } from 'bun:test';
import { SokobanPlayBoard } from '@libs/sokoban-client-ts/sokoban-play-board';
import {
  MAXIMUM_BOARD,
  TWO_CRATES,
} from '@libs/sokoban-client-ts/sokoban-player.example';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  applySokobanMove,
  initialSokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-position';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent, within } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';

// regression: sokoban-walk-revisits-static-terrain
test.each([
  {
    width: 320,
    height: 740,
    definition: MAXIMUM_BOARD,
    pushes: 6,
    worker: 'H2',
  },
  { width: 1440, height: 900, definition: TWO_CRATES, pushes: 2, worker: 'D4' },
])('walking at $width px reads terrain only under moving pieces', (fixture) => {
  const decoded = decodeSokobanBoard(fixture.definition);
  if (!decoded.valid) throw new Error('Invalid test board');
  const layout = decoded.value;
  const initial = initialSokobanPosition(layout);
  if (!initial.valid) throw new Error('Invalid test position');
  const [position, setPosition] = createSignal(initial.value);
  const reads: number[] = [];
  const board = {
    ...layout,
    squares: new Proxy(layout.squares, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && /^\d+$/.test(prop))
          reads.push(Number(prop));
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="light" fixedLayout={fixture}>
      <SokobanPlayBoard
        board={board}
        position={position()}
        describedBy="directions"
        onDirection={(direction) => {
          const next = applySokobanMove(layout, position(), direction);
          if (!next.valid) throw new Error('Refused regression move');
          setPosition(next.value);
        }}
        onTile={() => undefined}
      />
    </ThemeProvider>
  ));
  const grid = view.getByTestId('sokoban-board');
  const press = (key: string) => {
    fireEvent.keyDown(grid, { key });
    flush();
  };
  if (fixture.width === 320) {
    fireEvent.click(view.getByRole('button', { name: 'Look closer' }));
    flush();
  }
  for (let i = 0; i < fixture.pushes; i++) press('ArrowRight');
  const places = new Set(
    position().crates.map((cell) => cell.y * board.width + cell.x)
  );
  const tile = within(grid).getByRole('img', {
    name: `${fixture.worker}: floor, worker`,
  });
  reads.length = 0;
  for (let i = 0; i < 20; i++) {
    press(i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
    expect(tile.getAttribute('aria-label')).toBe(
      `${fixture.worker}: floor${i % 2 === 0 ? '' : ', worker'}`
    );
    const { x, y } = position().worker;
    places.add(y * board.width + x);
  }
  expect(position().moves).toBe(20 + fixture.pushes);
  expect(reads.filter((index) => !places.has(index))).toHaveLength(0);
});
