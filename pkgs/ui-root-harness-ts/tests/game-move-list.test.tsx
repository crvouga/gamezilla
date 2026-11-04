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
    const [current, setCurrent] = createSignal(3);
    const chosen: number[] = [];
    renderUi(() => (
      <GameMoveList
        layout="row"
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
});
