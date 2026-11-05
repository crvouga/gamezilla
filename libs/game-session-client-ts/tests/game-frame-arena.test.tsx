/** A game played in real time: no empty record card, the players beside a wide arena. */

import { afterEach, expect, test } from 'bun:test';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
} from '@libs/game-session-client-ts/game-frame-empty';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from '@libs/game-session-client-ts/game-frame-screen-view';
import type {
  FramePlaySeat,
  FrameRecord,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function seat(side: GameSide, name: string): FramePlaySeat {
  return {
    side,
    sideLabel: name,
    holder: { kind: 'person', person: `${name}-id` },
    plainName: name,
    swatch: { mark: '●' },
    clock: null,
    stat: { label: 'Wins', value: '0' },
    state: null,
    standIn: false,
    committed: false,
    choosing: false,
    facts: [],
    deciding: false,
    reclaim: false,
  };
}

/** A real-time game's record: no turns, so no moves to list. */
const RECORD: FrameRecord = {
  earlier: [],
  selection: 'live',
  turns: false,
  moves: [],
  perTurn: 1,
  movers: [],
  displayedPly: 0,
  error: '',
  history: true,
};

const resolved = async (): Promise<void> => undefined;

function props(): GameFrameScreenViewProps {
  return {
    title: 'Light Cycles Trio',
    phase: 'active',
    viewerSide: 'white',
    watchers: 0,
    connection: 'online',
    error: '',
    stopped: false,
    status: {
      lineup: '',
      description: 'Round 1 · first to 3',
      plainTurn: false,
      emphasis: 'neutral',
      tone: 'neutral',
      sending: false,
      minutes: 0,
      increment: 0,
    },
    canCreate: false,
    playerCount: 3,
    setup: null,
    table: {
      shape: 'rail',
      near: seat('white', 'avery'),
      others: [seat('black', 'jordan'), seat('red', 'morgan')],
    },
    play: { ...FRAME_NO_PLAY, canResign: true },
    result: null,
    next: FRAME_NO_NEXT,
    record: RECORD,
    board: <div data-testid="arena" />,
    onChoose: resolved,
    onReady: resolved,
    onPlayBot: resolved,
    onRandomSetup: resolved,
    onBack: () => undefined,
    onSeek: () => undefined,
    onReturnLive: () => undefined,
    onSelectRecord: () => undefined,
    onOpenHistory: () => undefined,
  };
}

function mount(width: number): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
        <GameFrameScreenView {...props()} />
      </ThemeProvider>
    </ClockProvider>
  ));
}

// regression: realtime-empty-game-record — beside a wide Light Cycles
// arena the rail was a "Game record" card holding only History and stats,
// a real-time game having no moves to list, and its commands sat apart.
test('wide: a real-time game has no record card; its players, history and commands share the rail', () => {
  mount(1440);
  expect(
    document.querySelector('[data-component="CustomGameReview"]')
  ).toBeNull();
  const layout = document.querySelector('[data-component="GameLayout"]');
  expect(layout?.getAttribute('data-arena')).toBe('true');
  const board = screen.getByTestId(
    'custom-game-scoreboard'
  ) as HTMLElement | null;
  expect(board?.textContent).toContain('Round 1 · first to 3');
  for (const name of [
    'custom-game-white',
    'custom-game-black',
    'custom-game-red',
  ])
    expect(board?.querySelector(`[data-testid="${name}"]`)).not.toBeNull();
  expect(
    board?.querySelector('[data-testid="custom-game-history-stats"]')
  ).not.toBeNull();
  // Each seat shows once: in the scoreboard, not again around the arena.
  expect(screen.getAllByTestId('custom-game-white')).toHaveLength(1);
});

test('phone: a real-time game keeps its seats around the arena and its history beside the actions', () => {
  mount(390);
  expect(
    document.querySelector('[data-component="CustomGameReview"]')
  ).toBeNull();
  expect(screen.queryByTestId('custom-game-scoreboard')).toBeNull();
  expect(screen.getByTestId('custom-game-seat-near')).toBeTruthy();
  expect(screen.getByTestId('custom-game-history-stats')).toBeTruthy();
});
