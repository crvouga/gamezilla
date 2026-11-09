import { afterEach, expect, test } from 'bun:test';
import {
  FrameNearSeatView,
  FrameOthersView,
} from '@libs/game-session-client-ts/game-frame-table-view';
import type {
  FramePlaySeat,
  FrameTable,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen, within } from '@solidjs/testing-library';

afterEach(cleanup);

function seat(side: GameSide, own = false): FramePlaySeat {
  return {
    side,
    sideLabel: side,
    holder: { kind: 'person', person: side },
    plainName: own ? 'Avery with a very long player name' : `Player ${side}`,
    swatch: { mark: '●' },
    clock: null,
    stat: { label: 'Score', value: own ? '9999' : '1234' },
    state: null,
    standIn: false,
    committed: false,
    choosing: false,
    facts: ['7 tiles'],
    deciding: own,
    reclaim: false,
  };
}

function mount(
  count: number,
  viewer: GameSide | null,
  compact = true,
  optIn = true
): void {
  const time = createHarnessClock();
  const sides = ['black', 'red', 'blue'] as const;
  const table: FrameTable = {
    shape: count === 2 ? 'strip' : 'rail',
    ...(optIn ? { seatLayout: 'compact-rail' as const } : {}),
    near: seat('white', true),
    others: sides.slice(0, count - 1).map((side) => seat(side)),
  };
  const common = {
    table,
    viewerSide: viewer,
    compact,
    onChoose: async () => undefined,
  };
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: compact ? 320 : 1440, height: 740 }}
      >
        <FrameOthersView {...common} />
        <div data-testid="word-board" />
        <FrameNearSeatView {...common} />
      </ThemeProvider>
    </ClockProvider>
  ));
}

// regression: word-tiles-compact-local-score-below-board
test('Word Tiles opt-in compact rail keeps the two-player local score above the board', () => {
  mount(2, 'white');
  const own = screen.getByTestId('custom-game-seat-near');
  expect(
    own.compareDocumentPosition(screen.getByTestId('word-board')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(within(own).getByText('9999')).toBeInTheDocument();
  expect(within(own).getByText('You')).toBeInTheDocument();
  expect(
    document.querySelectorAll('[data-component="GamePlayerChip"]')
  ).toHaveLength(2);
});

// regression: word-tiles-compact-spectator-identity
test('Word Tiles compact spectators retain every score without claiming the nearest seat', () => {
  for (const count of [3, 4, 2]) {
    mount(count, null);
    expect(
      document.querySelectorAll('[data-component="GamePlayerChip"]')
    ).toHaveLength(count);
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.getAllByTestId('custom-game-seat-near')).toHaveLength(1);
    expect(
      screen.getByText('Avery with a very long player name')
    ).toBeInTheDocument();
    expect(screen.getByText('9999')).toBeInTheDocument();
    cleanup();
  }
});

test('default two-player tables and wide opt-in tables retain opposed strips', () => {
  for (const settings of [
    { compact: true, optIn: false },
    { compact: false, optIn: true },
  ]) {
    mount(2, 'white', settings.compact, settings.optIn);
    const board = screen.getByTestId('word-board');
    expect(
      board.compareDocumentPosition(
        screen.getByTestId('custom-game-seat-near')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      document.querySelectorAll('[data-component="GamePlayerChip"]')
    ).toHaveLength(0);
    cleanup();
  }
});

test('all Word Tiles table sizes identify the seated viewer once beside every score', () => {
  for (const count of [2, 3, 4]) {
    mount(count, 'white');
    expect(screen.getAllByText('You')).toHaveLength(1);
    expect(screen.getAllByText('1234')).toHaveLength(count - 1);
    expect(screen.getByText('9999')).toBeInTheDocument();
    cleanup();
  }
});

// regression: word-tiles-active-own-chip-badge-contrast
test('the active own chip fills its You badge so it stays legible on the turn tint', () => {
  mount(2, 'white');
  const badge = within(screen.getByTestId('custom-game-seat-near'))
    .getByText('You')
    .closest('[data-component="Badge"]');
  expect(badge?.getAttribute('data-tone')).toBe('solid');
});
