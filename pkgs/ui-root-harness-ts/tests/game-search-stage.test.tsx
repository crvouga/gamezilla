/** @jsxImportSource @solidjs/web */

import { describe, expect, test } from 'bun:test';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSearchStage } from '@pkgs/ui-root-client-ts/game-search-stage';
import { screen } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

describe('GameSearchStage', () => {
  test('the wait is one state on a board-sized area, over the seat strip', () => {
    renderUi(() => (
      <GameSearchStage
        motif="discs"
        title="Searching…"
        description="Looking for an opponent."
        elapsed="3 seconds"
        seat={<GamePlayerBar name="River" dataSet={{ testid: 'seat' }} />}
      />
    ));
    const stage = mustQuery('[data-component="GameSearchStage"]');
    const board = mustQuery('[data-game-slot="search-board"]');
    expect(stage.children[0]).toBe(board);
    expect(board.querySelector('[data-motif="discs"]')).toBeTruthy();
    expect(stage.children[1]?.contains(screen.getByTestId('seat'))).toBe(true);
    expect(
      board.contains(screen.getByRole('heading', { name: 'Searching…' }))
    ).toBe(true);
    expect(
      screen.getByText('Looking for an opponent.').getAttribute('role')
    ).toBe('status');
    expect(screen.getByRole('timer').textContent).toBe('3 seconds');
    // Searching is announced as a state; the board area itself has no controls.
    expect(board.querySelector('button')).toBeNull();
  });

  test('a stage without a seat is the board area alone', () => {
    renderUi(() => (
      <GameSearchStage
        motif="discs"
        title="Searching…"
        description="Looking."
        elapsed="1 second"
      />
    ));
    expect(document.querySelector('[data-game-slot="search-seat"]')).toBeNull();
  });

  test('a mark replaces the spinner', () => {
    renderUi(() => (
      <GameSearchStage
        motif="discs"
        title="You're offline"
        description="Reconnect."
        elapsed="Searched 3 seconds"
        mark={<span data-testid="still-mark" />}
      />
    ));
    expect(screen.getByTestId('still-mark')).toBeTruthy();
    expect(document.querySelector('[data-component="Spinner"]')).toBeNull();
  });
});
