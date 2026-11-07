/** A phone's turn game: one status strip pinned under the top bar, above the board. */

import { afterEach, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

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

function mount(
  width: number,
  plainTurn = false,
  over: Partial<GameFrameScreenViewProps> = {}
): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
        <GameFrameScreenView {...props(plainTurn)} {...over} />
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

// regression: battleship-phone-strip-cramped — under the game's own line
// ("Red fleet fired at C4 and missed. Your turn to fire.") the strip still
// said "Live" beside the shown turn, which then wrapped into a cramped
// two-line block and pushed the person's own seat off a phone's screen.
// That line already says the board is live: the turn has the row to itself.
test("phone: beside the game's own line the shown turn has the row to itself", () => {
  mount(390);
  expect(screen.getByTestId('custom-game-record-caption').textContent).toBe(
    FIRED
  );
  expect(screen.queryByTestId('custom-game-move-strip-place')).toBeNull();
  const head = screen.getByTestId('custom-game-move-strip-head');
  expect(head.contains(screen.getByTestId('custom-game-move-strip'))).toBe(
    true
  );
});

test('phone: with no line of its own the strip says the board is live', () => {
  mount(390, true);
  expect(screen.getByTestId('custom-game-move-strip-place').textContent).toBe(
    'Live'
  );
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
    // regression: game-rail-actions-ragged — beside a wide board Offer draw
    // and Resign sat on one row and History and stats wrapped alone onto a
    // second, out of line with them. In the rail it drops its chevron so
    // the three share one row; a phone's row keeps the chevron.
    expect(history.querySelector('svg') === null).toBe(width === 1440);
    cleanup();
  }
});

// regression: battleship-phone-strip-clips-move — under a phone's top bar
// the Battleship strip read "Move 4 ● G2 hit ● C4 mi": the shown turn was
// one line wider than its well, cut mid-word at the well's edge. The turn
// wraps between its moves onto a second line instead, every move whole.
test('phone: a turn too long for the strip wraps between its moves, never cut', () => {
  mount(390);
  const strip = screen.getByTestId('custom-game-move-strip');
  expect(strip.getAttribute('data-overflow')).toBe('wrap');
  const list = strip.querySelector('[data-component="GameMoveList"]');
  expect(list?.getAttribute('data-wrap')).toBe('true');
  // The row holding the moves may shrink to the well (a box keeps its
  // width otherwise), so they wrap inside it instead of running out.
  expect(list?.parentElement?.classList.contains('shrink')).toBe(true);
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/game-move-list/game-move-list.module.css'
    ),
    'utf8'
  );
  const head =
    '.list[data-layout="turn"][data-wrap="true"] .turns,\n.list[data-layout="turn"][data-wrap="true"] .turn {';
  const start = css.indexOf(head);
  expect(start).toBeGreaterThan(-1);
  const rule = css.slice(start, css.indexOf('}', start));
  expect(rule).toMatch(/flex-wrap:\s*wrap;/);
  // A move itself never breaks: its button keeps one line.
  const button = css.slice(css.indexOf('.moveButton {'));
  expect(button.slice(0, button.indexOf('}'))).toMatch(
    /white-space:\s*nowrap;/
  );
});

// regression: phone-strip-two-moves-two-lines — under a phone's top bar the
// record strip spent two lines on "Move 5 ● col 7 ◆ col 4": the well's
// 12px side padding and 12px step between moves left the turn 7px short of
// one line, so the strip stood 86px tall above the board. Slim padding and
// an 8px step keep a two-move turn on one line.
test('phone: a two-move turn keeps one line in the strip’s well', () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/game-move-list/game-move-list.module.css'
    ),
    'utf8'
  );
  // The last rule opened by `head`: the one that sets this alone.
  const body = (head: string): string => {
    const start = css.lastIndexOf(`${head} {`);
    expect(start).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('}', start));
  };
  expect(body('.list[data-layout="turn"][data-wrap="true"]')).toMatch(
    /padding: var\(--ui-space-1\);/
  );
  expect(body('.list[data-layout="turn"][data-wrap="true"] .turn')).toMatch(
    /column-gap: var\(--ui-space-2\);/
  );
});

// regression: shared-board-terminal-buried
// Literal completed seven-drop Connect Four state formerly labelled Live,
// with the outcome and rematch below the final board and both participants.
test('completed win and draw lead the final board with one real rematch and history', async () => {
  for (const width of [390, 1440]) {
    for (const headline of ['You win', 'Draw']) {
      const onChoose = mock(async () => undefined);
      mount(width, true, {
        phase: 'completed',
        record: {
          ...RECORD,
          moves: ['1', '2', '1', '2', '1', '2', '1'],
          displayedPly: 7,
        },
        result: {
          headline,
          note: 'Host starts the rematch',
          scoreLabel: null,
          standings: [],
        },
        next: { plays: true, canCreate: true, reviewable: true },
        onChoose,
      });
      const outcome = screen.getByTestId('custom-game-outcome');
      const board = screen.getByTestId('board');
      expect(
        outcome.compareDocumentPosition(board) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(outcome.textContent).toContain(headline);
      expect(screen.getAllByTestId('custom-game-rematch')).toHaveLength(1);
      expect(outcome.contains(screen.getByTestId('custom-game-rematch'))).toBe(
        true
      );
      expect(screen.getAllByTestId('custom-game-history-stats')).toHaveLength(
        1
      );
      if (width === 390)
        expect(
          screen.getByTestId('custom-game-move-strip-place').textContent
        ).toBe('Finished');
      fireEvent.click(screen.getByTestId('custom-game-rematch'));
      expect(onChoose).toHaveBeenCalledWith({ operation: 'rematch' });
      cleanup();
    }
  }
});

// regression: completed-game-outcome-reason-missing
test('completed game keeps the resignation reason in its completion header', () => {
  const time = createHarnessClock();
  const frame = props(false);
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameFrameScreenView
          {...frame}
          phase="completed"
          status={{
            ...frame.status!,
            description: 'Black wins by resignation.',
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  const status = screen.getByTestId('custom-game-status');
  expect(status.textContent).toContain('Black wins by resignation.');
  expect(screen.getByTestId('custom-game-outcome').contains(status)).toBe(true);
});
