/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { GameChoiceGrid } from '@pkgs/ui-root-client/game-choice-grid';
import { GameClock } from '@pkgs/ui-root-client/game-clock';
import { GameHeader } from '@pkgs/ui-root-client/game-header';
import { screen } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

describe('Game chrome', () => {
  test('the header leads with the title and keeps context as a caption', () => {
    renderUi(() => (
      <GameHeader
        context="Chess · Matchmaking"
        title="Your next great game"
        description="Pick a pace and play."
      />
    ));
    const header = mustQuery('[data-component="GameHeader"]');
    const title = screen.getByRole('heading', { name: 'Your next great game' });
    const context = screen.getByText('Chess · Matchmaking');
    expect(header.querySelector('svg')).toBeNull();
    expect(
      title.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(context.className).not.toMatch(/uppercase/);
    expect(screen.getByText('Pick a pace and play.')).toBeInTheDocument();
  });

  test('the active clock is chosen and the time stays in the control', () => {
    renderUi(() => (
      <>
        <GameClock label="White" value="5:00" active ariaLabel="White 5:00" />
        <GameClock label="Black" value="4:12" ariaLabel="Black 4:12" />
      </>
    ));
    const clocks = document.querySelectorAll('[data-component="GameClock"]');
    expect(clocks[0]).toHaveAttribute('data-active', 'true');
    expect(clocks[1]).toHaveAttribute('data-active', 'false');
    expect(screen.getByLabelText('White 5:00')).toHaveTextContent('5:00');
    expect(screen.getByLabelText('Black 4:12')).toHaveTextContent('4:12');
  });

  test('the selected pace is a chosen control with a visible name', () => {
    renderUi(() => (
      <GameChoiceGrid
        label="Round length"
        value="5"
        onChange={() => undefined}
        choices={[
          { value: '5', title: '5 min', detail: 'Standard' },
          { value: '10', title: '10 min', detail: 'Longer' },
        ]}
      />
    ));
    const selected = screen.getByRole('radio', { name: /5 min/ });
    const other = screen.getByRole('radio', { name: /10 min/ });
    expect(selected).toBeChecked();
    expect(other).not.toBeChecked();
    expect(selected.closest('label')).toHaveAttribute('data-selected', 'true');
    expect(other.closest('label')).toHaveAttribute('data-selected', 'false');
    expect(screen.getByText('Round length')).toBeInTheDocument();
  });
});
