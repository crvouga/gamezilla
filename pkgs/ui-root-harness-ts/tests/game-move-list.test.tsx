/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  // regression: connect-four-record-col-noise — beside a wide board every
  // row of the Connect Four record read "● col 4", the disc crowding a word
  // the seat columns already make plain. The table reads "● 4".
  test('the table leaves out the word a bare-number move is read with', () => {
    const columns: readonly GameMoveListEntry[] = ['4', '5'].map(
      (label, index) => ({
        ply: index + 1,
        label,
        prefix: 'col',
        swatch: index === 0 ? { mark: '●' } : { mark: '◆' },
        accessibleName: `Move ${String(index + 1)}: column ${label}`,
      })
    );
    renderUi(() => (
      <GameMoveList
        layout="table"
        aria-label="Moves played"
        perTurn={2}
        current={2}
        moves={columns}
        onSelect={() => undefined}
      />
    ));
    const list = screen.getByRole('list', { name: 'Moves played' });
    expect(list.textContent).toBe('1●4◆5');
  });

  // regression: battleship-record-truncated — the record beside a wide
  // Battleship board cut a move written in words to "G10 sinks the d": a
  // table move wraps inside its column instead of being clipped.
  test('a table move written in words wraps, never clipped', () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/game-move-list/game-move-list.module.css'
      ),
      'utf8'
    );
    const start = css.indexOf('.list[data-layout="table"] .moveButton {');
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toMatch(/white-space:\s*normal;/);
    expect(rule).not.toMatch(/overflow:\s*hidden|text-overflow/);
  });

  // regression: battleship-record-line-wraps — beside a wide Battleship
  // board "G10 sinks the destroyer" wrapped onto a second line in an
  // equal-width seat column while "F10 hit" left its own half empty, so one
  // turn stood twice as tall as the rest. The turns share one grid whose
  // seat columns size to their longest move (each turn a subgrid), so a
  // worded move takes the room the short ones leave and the columns align.
  test('the table sizes its seat columns by their longest move, aligned across turns', () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/game-move-list/game-move-list.module.css'
      ),
      'utf8'
    );
    const body = (head: string): string => {
      const start = css.indexOf(head);
      expect(start).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf('}', start));
    };
    expect(body('.list[data-layout="table"] .turns {')).toMatch(
      /grid-template-columns:\s*32px repeat\(var\(--move-columns\), auto\);/
    );
    const turn = body('.list[data-layout="table"] .turn {');
    expect(turn).toMatch(/grid-template-columns:\s*subgrid;/);
    expect(turn).toMatch(/grid-column:\s*1 \/ -1;/);
  });
});
