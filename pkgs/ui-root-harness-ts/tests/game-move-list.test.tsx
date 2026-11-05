/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { fireEvent, screen, within } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

const MOVES: readonly GameMoveListEntry[] = ['e4', 'e5', 'Nf3'].map(
  (label, index) => ({
    ply: index + 1,
    label,
    swatch: index % 2 === 0 ? { mark: '○' } : { mark: '●' },
    accessibleName: `Move ${String(index + 1)}: ${label}`,
    testId: `move-${String(index + 1)}`,
  })
);

describe('GameMoveList', () => {
  test('moves group into numbered turns and each button holds only its move', () => {
    renderUi(() => (
      <GameMoveList
        layout="table"
        aria-label="Moves played"
        perTurn={2}
        current={3}
        moves={MOVES}
        onSelect={() => undefined}
      />
    ));
    const list = screen.getByRole('list', { name: 'Moves played' });
    const turns = within(list).getAllByRole('listitem');
    expect(turns).toHaveLength(2);
    const [first] = turns;
    if (first === undefined) throw new Error('No first turn');
    expect(within(first).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTestId('move-1').textContent).toBe('e4');
    expect(screen.getByTestId('move-3')).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByTestId('move-1')).not.toHaveAttribute('aria-current');
  });

  test('choosing a move moves the mark to it', () => {
    const [current, setCurrent] = createSignal(2);
    const chosen: number[] = [];
    renderUi(() => (
      <GameMoveList
        layout="turn"
        aria-label="Moves played"
        perTurn={2}
        current={current()}
        moves={MOVES}
        onSelect={(ply) => {
          chosen.push(ply);
          setCurrent(ply);
        }}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Move 1: e4' }));
    expect(chosen).toEqual([1]);
    expect(screen.getByTestId('move-1')).toHaveAttribute(
      'aria-current',
      'step'
    );
  });

  // regression: phone-move-strip-cuts-a-move
  test('the strip shows the whole turn holding the shown move, and only it', () => {
    const [current, setCurrent] = createSignal(3);
    renderUi(() => (
      <GameMoveList
        layout="turn"
        aria-label="Moves played"
        perTurn={2}
        current={current()}
        moves={MOVES}
        onSelect={setCurrent}
      />
    ));
    const list = screen.getByRole('list', { name: 'Moves played' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('move-3')).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.queryByTestId('move-1')).toBeNull();
    setCurrent(2);
    expect(screen.getByTestId('move-1').textContent).toBe('e4');
    expect(screen.getByTestId('move-2')).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.queryByTestId('move-3')).toBeNull();
    // The opening position shows the first turn, nothing marked.
    setCurrent(0);
    expect(screen.getByTestId('move-1')).not.toHaveAttribute('aria-current');
  });

  // regression: connect-four-moves-read-as-bare-numbers — the phone strip
  // read "4 ● 3 ◆ 2": nothing said 4 was a move's number and 3 a column.
  test('a bare-number move is read with its word, and the shown turn is named', () => {
    const columns: readonly GameMoveListEntry[] = ['3', '2'].map(
      (label, index) => ({
        ply: index + 7,
        label,
        prefix: 'col',
        swatch: index === 0 ? { mark: '●' } : { mark: '◆' },
        accessibleName: `Move ${String(index + 7)}: column ${label}`,
        testId: `move-${String(index + 7)}`,
      })
    );
    renderUi(() => (
      <GameMoveList
        layout="turn"
        aria-label="Moves played"
        perTurn={2}
        current={8}
        moves={columns}
        onSelect={() => undefined}
        turnLabel={(turn) => `Move ${String(turn)}`}
      />
    ));
    const list = screen.getByRole('list', { name: 'Moves played' });
    expect(list.textContent).toBe('Move 4●col3◆col2');
    // The button keeps the move exactly as the game writes it.
    expect(screen.getByTestId('move-7').textContent).toBe('3');
    expect(screen.getByTestId('move-8').textContent).toBe('2');
  });

  test('the table keeps bare turn numbers', () => {
    renderUi(() => (
      <GameMoveList
        layout="table"
        aria-label="Moves played"
        perTurn={2}
        current={3}
        moves={MOVES}
        onSelect={() => undefined}
        turnLabel={(turn) => `Move ${String(turn)}`}
      />
    ));
    expect(screen.queryByText('Move 1')).toBeNull();
  });
});
