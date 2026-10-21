/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { GameClock } from '@pkgs/ui-root-client-ts/game-clock';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameStatus } from '@pkgs/ui-root-client-ts/game-status';
import { screen } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

describe('Game chrome', () => {
  test('a game inside a host names itself once and draws no second top bar', () => {
    renderUi(() => (
      <GameScreen screenId="orbit-rally" title="Orbit Rally">
        <p class="text">{'board'}</p>
      </GameScreen>
    ));
    const root = mustQuery('[data-component="GameScreen"]');
    expect(root.getAttribute('data-screen')).toBe('orbit-rally');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Orbit Rally' })).toBeTruthy();
    expect(document.querySelector('[data-component="TopBar"]')).toBeNull();
    expect(
      document.querySelector('[data-component="ScreenBaseHeader"]')
    ).toBeNull();
    expect(document.querySelector('[data-testid="nav-back"]')).toBeNull();
  });

  test('the seats sit around the board, the far seat first', () => {
    renderUi(() => (
      <GameBoardStage
        top={<GamePlayerBar name="Atlas" dataSet={{ testid: 'far' }} />}
        bottom={<GamePlayerBar name="Nova" dataSet={{ testid: 'near' }} />}
      >
        <div data-testid="board" />
      </GameBoardStage>
    ));
    const order = [...mustQuery('[data-component="GameBoardStage"]').children];
    expect(order[0]).toBe(screen.getByTestId('far'));
    expect(order[1]?.contains(screen.getByTestId('board'))).toBe(true);
    expect(order[2]).toBe(screen.getByTestId('near'));
  });

  test('an empty seat draws the person placeholder, not an icon', () => {
    renderUi(() => <GamePlayerBar name="Open place" />);
    const avatar = mustQuery('[data-component="Avatar"]');
    expect(avatar.getAttribute('data-placeholder')).toBe('true');
    expect(avatar.querySelector('svg[viewBox="0 0 40 40"]')).not.toBeNull();
  });

  test('the status line announces its words but not its trailing facts', () => {
    renderUi(() => (
      <GameStatus
        live
        tone="active"
        title="Your turn."
        detail="Make your first move"
        trailing={<span data-testid="fact">{'5+0'}</span>}
        dataSet={{ testid: 'words' }}
      />
    ));
    const words = screen.getByRole('status');
    expect(words).toBe(screen.getByTestId('words'));
    expect(words).toHaveAttribute('aria-live', 'polite');
    expect(words).toHaveTextContent('Your turn.Make your first move');
    expect(words.contains(screen.getByTestId('fact'))).toBe(false);
    expect(mustQuery('[data-component="GameStatus"]')).toHaveAttribute(
      'data-tone',
      'active'
    );
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

  test('a clock that is nearly used up says so with more than its colour', () => {
    renderUi(() => (
      <>
        <GameClock label="White" value="0:09" active low ariaLabel="low" />
        <GameClock label="Black" value="4:12" ariaLabel="plenty" />
      </>
    ));
    const clocks = document.querySelectorAll('[data-component="GameClock"]');
    expect(clocks[0]).toHaveAttribute('data-low', 'true');
    expect(clocks[1]).toHaveAttribute('data-low', 'false');
    expect(clocks[0]?.querySelector('[data-component="Icon"]')).not.toBeNull();
    expect(clocks[1]?.querySelector('[data-component="Icon"]')).toBeNull();
    expect(screen.getByLabelText('low')).toHaveAttribute('data-low', 'true');
    expect(screen.getByLabelText('low')).toHaveTextContent('0:09');
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
