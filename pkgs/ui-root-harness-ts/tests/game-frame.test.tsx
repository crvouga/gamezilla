/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import { formatOrdinal } from '@pkgs/ui-root-client-ts/game-ordinal';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import {
  GamePlayerChip,
  GamePlayerRail,
} from '@pkgs/ui-root-client-ts/game-player-rail';
import {
  type GameStandingRow,
  GameStandings,
} from '@pkgs/ui-root-client-ts/game-result';
import { GameSeatSwatch } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import {
  GameSessionHeader,
  GameSessionLayout,
} from '@pkgs/ui-root-client-ts/game-session-layout';
import {
  GameWatcherCount,
  GameWatchingFooter,
} from '@pkgs/ui-root-client-ts/game-watching';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
import { fireEvent, screen, within } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { mustQuery, renderUi } from './render';

describe('Game frame: the players', () => {
  test('the rail lists every chip and marks only the active one as the current step', () => {
    renderUi(
      () => (
        <GamePlayerRail aria-label="Other players">
          <GamePlayerChip name="Erin" swatch={{ color: 'player2' }} />
          <GamePlayerChip name="Stockfish" active />
          <GamePlayerChip
            name="Maximilian Featherstonehaugh the Third of Many Names"
            state={{ kind: 'out', label: 'Out' }}
          />
        </GamePlayerRail>
      ),
      { width: 360 }
    );
    const rail = screen.getByRole('list', { name: 'Other players' });
    const chips = within(rail).getAllByRole('listitem');
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => chip.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
    ]);
    expect(chips[1]).toHaveAttribute('data-active', 'true');
    expect(rail).toHaveAttribute('data-component', 'GamePlayerRail');
    expect(rail.className).toContain('scrollHorizontal');
  });

  test('out and reconnecting are told in words, not color alone', () => {
    renderUi(() => (
      <>
        <GamePlayerChip name="Sam" state={{ kind: 'out', label: 'Out' }} />
        <GamePlayerBar
          name="Robin"
          state={{ kind: 'reconnecting', label: 'Reconnecting' }}
        />
      </>
    ));
    const states = document.querySelectorAll(
      '[data-component="GamePlayerState"]'
    );
    expect([...states].map((state) => state.textContent)).toEqual([
      'Out',
      'Reconnecting',
    ]);
    expect(states[0]).toHaveAttribute('data-state', 'out');
    expect(states[1]).toHaveAttribute('data-state', 'reconnecting');
    expect(mustQuery('[data-component="GamePlayerBar"]')).toHaveAttribute(
      'data-state',
      'reconnecting'
    );
  });

  test('a chip carries its facts as tags, and an empty fact row takes no room', () => {
    renderUi(() => (
      <GamePlayerRail aria-label="Other players">
        <GamePlayerChip
          name="Erin"
          tags={<Badge label="Passed" dataSet={{ testid: 'erin-passed' }} />}
        />
        <GamePlayerChip name="Sam" tags={<Show when={false}>{'never'}</Show>} />
      </GamePlayerRail>
    ));
    const [erin, sam] = screen.getAllByRole('listitem');
    if (erin === undefined || sam === undefined) throw new Error('two chips');
    expect(within(erin).getByText('Passed')).toBeInTheDocument();
    expect(mustQuery('[data-testid="erin-passed"]')).toBeInTheDocument();
    expect(sam.textContent).toBe('Sam');
  });

  test('a pressable chip and strip are buttons named by the player', () => {
    const pressed: string[] = [];
    renderUi(() => (
      <>
        <GamePlayerChip name="Erin" onPress={() => pressed.push('chip')} />
        <GamePlayerBar
          name="Robin"
          active
          stat={{ label: 'Score', value: '12' }}
          onPress={() => pressed.push('bar')}
        />
      </>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Erin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Robin' }));
    expect(pressed).toEqual(['chip', 'bar']);
    const bar = mustQuery('[data-component="GamePlayerBar"]');
    expect(bar).toHaveAttribute('aria-current', 'step');
    expect(
      bar.querySelector('[data-component="GameSeatStat"]')
    ).toHaveTextContent('Score12');
  });

  test('a swatch is decorative unless it is labelled', () => {
    renderUi(() => (
      <>
        <GameSeatSwatch look={{ color: 'player3', mark: '◆' }} />
        <GameSeatSwatch look={{ mark: 'X' }} label="Plays X" />
      </>
    ));
    const swatches = document.querySelectorAll(
      '[data-component="GameSeatSwatch"]'
    );
    expect(swatches[0]).toHaveAttribute('aria-hidden', 'true');
    expect(swatches[0]).toHaveAttribute('data-seat-color', 'player3');
    expect(screen.getByRole('img', { name: 'Plays X' })).toBe(
      swatches[1] as HTMLElement
    );
  });
});

describe('Game frame: actions and watching', () => {
  test('the action bar ships each test id, a primary step and pressed tools', () => {
    const pressed: string[] = [];
    renderUi(() => (
      <GameActionBar
        aria-label="Actions"
        items={[
          {
            id: 'move',
            label: 'Move',
            testId: 'game-mode-move',
            onPress: () => pressed.push('move'),
            pressed: true,
          },
          {
            id: 'h',
            label: 'Wall',
            testId: 'game-mode-h',
            onPress: () => pressed.push('h'),
            pressed: false,
          },
          {
            id: 'pass',
            label: 'Pass',
            testId: 'game-pass',
            onPress: () => pressed.push('pass'),
            emphasis: 'primary',
            disabled: true,
          },
        ]}
      >
        <button type="button">{'Resign'}</button>
      </GameActionBar>
    ));
    const group = screen.getByRole('group', { name: 'Actions' });
    expect(screen.getByTestId('game-mode-move')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('game-mode-h')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByTestId('game-pass')).not.toHaveAttribute('aria-pressed');
    expect(screen.getByTestId('game-pass')).toBeDisabled();
    expect(screen.getByTestId('game-pass')).toHaveAttribute(
      'data-intent',
      'primary'
    );
    fireEvent.click(screen.getByTestId('game-mode-h'));
    fireEvent.click(screen.getByTestId('game-pass'));
    expect(pressed).toEqual(['h']);
    expect(group.lastElementChild).toHaveTextContent('Resign');
  });

  test('an action bar with nothing to do draws nothing', () => {
    renderUi(() => (
      <GameActionBar items={[]}>
        <Show when={false}>{'Resign'}</Show>
      </GameActionBar>
    ));
    expect(document.querySelector('[data-component="GameActionBar"]')).toBe(
      null
    );
  });

  test('the watcher count is compact for the eye and named for a listener', () => {
    renderUi(() => (
      <>
        <GameWatcherCount value={12_400} label="12,400 watching" />
        <SpectatorIndicator count={{ value: 3, label: '3 watching' }} />
        <GameWatchingFooter title="You're watching" />
      </>
    ));
    const counts = document.querySelectorAll(
      '[data-component="GameWatcherCount"]'
    );
    expect(counts).toHaveLength(2);
    expect(counts[0]).toHaveAttribute('data-value', '12400');
    expect(counts[0]?.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '12.4K'
    );
    expect(counts[0]).toHaveTextContent('12,400 watching');
    expect(counts[1]).toHaveTextContent('3 watching');
    expect(screen.getByTestId('spectator-indicator')).toBeInTheDocument();
    expect(
      mustQuery('[data-component="GameWatchingFooter"]')
    ).toHaveTextContent("You're watching");
  });
});

function standingRow(place: number): GameStandingRow {
  return {
    id: `seat-${place}`,
    place,
    name: `Player ${place}`,
    score: String(100 - place),
    you: place === 3,
    readiness: place === 1 ? { label: 'Ready', ready: true } : null,
  };
}

describe('Game frame: game over', () => {
  test('standings list eight players in place order and mark the viewer', () => {
    const rows = [8, 3, 1, 5, 2, 7, 4, 6].map(standingRow);
    renderUi(() => (
      <GameStandings aria-label="Standings" scoreLabel="Points" rows={rows} />
    ));
    const list = screen.getByRole('list', { name: 'Standings' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(8);
    expect(items.map((item) => item.getAttribute('data-place'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
    expect(items[0]).toHaveTextContent('1stPlayer 1ReadyPoints 99');
    expect(items[7]).toHaveTextContent('8thPlayer 8Points 92');
    const current = items.filter((item) => item.hasAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(items[2]);
    expect(items[2]).toHaveAttribute('data-you', 'true');
  });

  test('a supplied ordinal wins over the computed one', () => {
    renderUi(() => (
      <GameStandings
        aria-label="Standings"
        rows={[{ id: 'a', place: 1, ordinal: 'Winner', name: 'Erin' }]}
      />
    ));
    expect(screen.getByRole('listitem')).toHaveTextContent('WinnerErin');
  });

  test('ordinals follow the locale ordinal rules', () => {
    const places = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111];
    expect(places.map((place) => formatOrdinal(place, 'en'))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ]);
    expect(formatOrdinal(2, 'en-GB')).toBe('2nd');
    expect(formatOrdinal(2, 'xx-not-a-locale!')).toBe('2');
  });
});

describe('Game frame: layout slots', () => {
  test('empty header and footer slots take no room', () => {
    renderUi(() => (
      <GameSessionLayout
        header={
          <Show when={false}>
            <GameSessionHeader title="Hidden" />
          </Show>
        }
        footer={null}
      >
        <div data-testid="stage" />
      </GameSessionLayout>
    ));
    const layout = mustQuery('[data-component="GameSessionLayout"]');
    expect(layout.children).toHaveLength(1);
    expect(layout.children[0]).toHaveAttribute('data-component', 'GameLayout');
  });

  test('a header and a footer frame the game', () => {
    renderUi(() => (
      <GameSessionLayout
        header={
          <GameSessionHeader
            title="Connect Four"
            trailing={<button type="button">{'Change game'}</button>}
          />
        }
        footer={<GameWatchingFooter title="You're watching" />}
      >
        <div data-testid="stage" />
      </GameSessionLayout>
    ));
    const layout = mustQuery('[data-component="GameSessionLayout"]');
    expect(layout.firstElementChild).toHaveAttribute(
      'data-component',
      'GameSessionHeader'
    );
    expect(layout.lastElementChild).toHaveAttribute(
      'data-component',
      'GameWatchingFooter'
    );
    expect(
      screen.getByRole('button', { name: 'Change game' })
    ).toBeInTheDocument();
  });

  test('a header with neither title nor trailing draws nothing', () => {
    renderUi(() => (
      <GameSessionLayout header={<GameSessionHeader />}>
        <div data-testid="stage" />
      </GameSessionLayout>
    ));
    expect(
      document.querySelector('[data-component="GameSessionHeader"]')
    ).toBeNull();
    expect(
      mustQuery('[data-component="GameSessionLayout"]').children
    ).toHaveLength(1);
  });
});

const BOARDS = [
  { value: '7', label: '7 × 7', testId: 'board-7' },
  { value: '9', label: '9 × 9', testId: 'board-9' },
];

describe('Game frame: options', () => {
  test('a choice is a single-select group of chips', () => {
    const [board, setBoard] = createSignal('7');
    renderUi(() => (
      <GameOptionField
        kind="choice"
        label="Board"
        options={BOARDS}
        value={board()}
        onChange={setBoard}
        testId="board"
      />
    ));
    const group = screen.getByRole('radiogroup', { name: 'Board' });
    expect(within(group).getByRole('radio', { name: '7 × 7' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    fireEvent.click(screen.getByTestId('board-9'));
    expect(within(group).getByRole('radio', { name: '9 × 9' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  test('a count is a stepper described by its range message', () => {
    const [points, setPoints] = createSignal(11);
    renderUi(() => (
      <GameOptionField
        kind="count"
        label="Points to win"
        value={points()}
        min={1}
        max={99}
        onChange={setPoints}
        message={{ text: 'From 1 to 99' }}
        testId="points"
      />
    ));
    const spin = screen.getByRole('spinbutton', { name: 'Points to win' });
    expect(spin).toHaveAttribute('aria-valuenow', '11');
    const message = screen.getByText('From 1 to 99');
    expect(spin.getAttribute('aria-describedby')).toContain(message.id);
    fireEvent.click(screen.getByTestId('points-increase'));
    expect(spin).toHaveAttribute('aria-valuenow', '12');
  });

  test('an invalid count says why in the error tone', () => {
    renderUi(() => (
      <GameOptionField
        kind="count"
        label="Rounds"
        value={0}
        min={0}
        max={9}
        onChange={() => undefined}
        message={{ text: 'Play at least one round.', tone: 'error' }}
      />
    ));
    expect(screen.getByText('Play at least one round.')).toHaveAttribute(
      'data-tone',
      'error'
    );
  });

  test('read-only shows each chosen value as text, with no control', () => {
    renderUi(() => (
      <>
        <GameOptionField
          kind="choice"
          label="Board"
          options={BOARDS}
          value="9"
          onChange={() => undefined}
          readOnly
        />
        <GameOptionField
          kind="count"
          label="Points to win"
          value={11}
          min={1}
          max={99}
          onChange={() => undefined}
          readOnly
        />
      </>
    ));
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    const fields = document.querySelectorAll(
      '[data-component="GameOptionField"]'
    );
    expect(fields[0]).toHaveAttribute('data-readonly', 'true');
    expect(fields[0]).toHaveTextContent('Board9 × 9');
    expect(fields[1]).toHaveTextContent('Points to win11');
  });
});
