/** A phone's turn game: one status strip pinned under the top bar, above the board. */

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

function seat(side: GameSide, name: string, deciding: boolean): FramePlaySeat {
  return {
    side,
    sideLabel: name,
    holder: { kind: 'person', person: `${name}-id` },
    plainName: name,
    swatch: { mark: '●' },
    clock: null,
    stat: null,
    state: null,
    standIn: false,
    committed: false,
    choosing: false,
    facts: [],
    deciding,
    reclaim: false,
  };
}

const RECORD: FrameRecord = {
  earlier: [],
  selection: 'live',
  turns: true,
  moves: ['C4', 'F2', 'G2'],
  perTurn: 2,
  movers: [],
  displayedPly: 3,
  error: '',
  history: true,
};

const resolved = async (): Promise<void> => undefined;

const FIRED = 'Red fleet fired at C4 and missed. Your turn to fire.';

function props(plainTurn: boolean): GameFrameScreenViewProps {
  return {
    title: 'Battleship',
    phase: 'active',
    viewerSide: 'white',
    watchers: 0,
    connection: 'online',
    error: '',
    stopped: false,
    status: {
      lineup: '',
      description: plainTurn ? 'Blue fleet to move.' : FIRED,
      plainTurn,
      emphasis: 'neutral',
      tone: 'neutral',
      sending: false,
      minutes: 0,
      increment: 0,
    },
    canCreate: false,
    playerCount: 2,
    setup: null,
    table: {
      shape: 'strip',
      near: seat('white', 'avery', true),
      others: [seat('black', 'jordan', false)],
    },
    play: { ...FRAME_NO_PLAY, canResign: true },
    result: null,
    next: FRAME_NO_NEXT,
    record: RECORD,
    board: <div data-testid="board" />,
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

function mount(width: number, plainTurn = false): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
        <GameFrameScreenView {...props(plainTurn)} />
      </ThemeProvider>
    </ClockProvider>
  ));
}

// regression: phone-game-status-buried — on a phone the game's line about
// the turn sat in a bubble under the board and again by the record, which
// began about 810px down, below the fold, so whose turn it was and the
// last move were buried. One strip pinned under the top bar, above the
// board, says both; the bubble by the board is for a listener only.
test('phone: one strip pinned above the board says the turn and the last move', () => {
  mount(390);
  const pinned = document.querySelector('[data-component="GameSessionPinned"]');
  if (pinned === null) throw new Error('No pinned strip');
  const record = screen.getByTestId('custom-game-record');
  expect(pinned.contains(record)).toBe(true);
  // The strip comes before the board.
  const board = screen.getByTestId('board');
  expect(
    pinned.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(screen.getByTestId('custom-game-record-caption').textContent).toBe(
    FIRED
  );
  expect(screen.getByTestId('custom-game-move-strip').textContent).toContain(
    'G2'
  );
  // Said once to the eye: the pill by the board is for a listener only.
  const status = screen.getByTestId('custom-game-status');
  expect(status.closest('[data-spoken-only="true"]')).not.toBeNull();
});

test('phone: the plain turn stays with the seat to move, not the strip', () => {
  mount(390, true);
  expect(screen.queryByTestId('custom-game-record-caption')).toBeNull();
});

// regression: phone-strip-empty-well — before the first move (Hearts while
// hands are passed) the pinned strip showed an empty well.
test('phone: before the first move the strip says there is none yet', () => {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameFrameScreenView
          {...props(false)}
          record={{ ...RECORD, moves: [], displayedPly: 0 }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(screen.getByTestId('custom-game-move-strip').textContent).toBe(
    'No moves yet.'
  );
});

test('wide: nothing is pinned; the record is the rail beside the board', () => {
  mount(1440);
  expect(
    document.querySelector('[data-component="GameSessionPinned"]')
  ).toBeNull();
  expect(
    document.querySelector('[data-component="CustomGameReview"]')
  ).not.toBeNull();
});

// regression: history-link-moves-around — "History and stats" sat at the
// record card's title beside a wide board but under the board on a phone,
// inside the record's disclosure for a turn game and beside Resign for a
// real-time one. It has one place: the end of the game's commands.
test("History and stats ends the game's commands on a phone and beside a wide board", () => {
  for (const width of [390, 1440]) {
    mount(width);
    const resign = screen.getByTestId('custom-game-resign');
    const row = resign.closest('[data-component="GameActions"]');
    const history = screen.getByTestId('custom-game-history-stats');
    expect(row?.contains(history)).toBe(true);
    expect(
      resign.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    cleanup();
  }
});
