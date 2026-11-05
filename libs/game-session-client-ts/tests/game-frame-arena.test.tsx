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
import { useGameTableSeat } from '@pkgs/ui-root-client-ts/game-table-seat';
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

// regression: phone-player-rail-clipped — on a phone the other riders
// were one sideways-scrolling strip cut off mid-name at the screen's edge,
// and the person's own seat sat below the arena and its steering pad, out
// of view. Every player is now a chip in a wrapping rail above the arena,
// the person's own first and marked "You".
test('phone: every player shows above the arena, the person first and marked as them', () => {
  mount(390);
  expect(
    document.querySelector('[data-component="CustomGameReview"]')
  ).toBeNull();
  expect(screen.queryByTestId('custom-game-scoreboard')).toBeNull();
  const rail = document.querySelector(
    '[data-component="GamePlayerRail"]'
  ) as HTMLElement;
  expect(rail.getAttribute('role')).toBe('list');
  const near = screen.getByTestId('custom-game-seat-near');
  expect(rail.firstElementChild).toBe(near);
  expect(
    near.querySelector('[data-testid="custom-game-white"]')
  ).not.toBeNull();
  expect(near.textContent).toContain('You');
  for (const name of ['custom-game-black', 'custom-game-red'])
    expect(rail.querySelector(`[data-testid="${name}"]`)).not.toBeNull();
  // The person shows once, in the rail.
  expect(screen.getAllByTestId('custom-game-white')).toHaveLength(1);
  expect(screen.getByTestId('custom-game-history-stats')).toBeTruthy();
});

// regression: unplayed-game-record-card — beside a wide Hearts table, while
// the hands were passed and nothing was played yet, the rail was a "Game
// record" card with nothing in it but History and stats. Then it was only a
// stray Resign and History. A game played by turns with no move yet keeps
// the record card every game's rail has, its caption the game's line about
// what happens now, so the card is never empty.
test('wide: a game played by turns with no move yet captions its record card with the turn line', () => {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 1440, height: 900 }}
      >
        <GameFrameScreenView
          {...props()}
          record={{ ...RECORD, turns: true }}
          table={{
            shape: 'rail',
            near: seat('white', 'avery'),
            others: [seat('black', 'jordan')],
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  const rail = screen.getByTestId('custom-game-unplayed-rail');
  const card = rail.querySelector('[data-component="CustomGameReview"]');
  expect(card?.textContent).toContain('Game record');
  expect(card?.textContent).toContain('Round 1 · first to 3');
  expect(
    card?.querySelector('[data-testid="custom-game-resign"]')
  ).not.toBeNull();
  expect(
    card?.querySelector('[data-testid="custom-game-history-stats"]')
  ).not.toBeNull();
  // The commands show once, in the card; the line is not drawn twice.
  expect(screen.getAllByTestId('custom-game-resign')).toHaveLength(1);
  expect(
    screen
      .getByTestId('custom-game-status')
      .closest('[data-component="GameTurnPill"]')
      ?.getAttribute('data-spoken-only')
  ).toBe('true');
});

// regression: hearts-seats-shown-twice — at a Hearts table every player
// showed twice: as a chip above the table and as a seat plate on it. A
// board that seats its players is lent each one, at their place at the
// table, and the frame draws no seats around it.
test('a board that seats its players is lent each player and no seat is drawn around it', () => {
  const time = createHarnessClock();
  const Seated = () => {
    const lend = useGameTableSeat();
    return <>{lend?.('black')}</>;
  };
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameFrameScreenView
          {...props()}
          record={{ ...RECORD, turns: true }}
          table={{
            shape: 'board',
            near: seat('white', 'avery'),
            others: [seat('black', 'jordan'), seat('red', 'morgan')],
          }}
          board={<Seated />}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(
    document.querySelector('[data-component="GamePlayerRail"]')
  ).toBeNull();
  expect(screen.queryByTestId('custom-game-seat-near')).toBeNull();
  const lent = screen.getByTestId('custom-game-black');
  expect(lent.getAttribute('data-component')).toBe('GameTableSeat');
  expect(screen.getByTestId('custom-game-black-person').textContent).toBe(
    'jordan'
  );
  expect(screen.getAllByTestId('custom-game-black')).toHaveLength(1);
});

// regression: setup-preview-below-start — on a phone the board preview of a
// game being set up fell under the Players card, after Start. It now leads
// the Players card's pair on a phone, as it sits beside the card when wide.
test('phone and wide: the board preview of a game being set up is paired with the Players card, before Start', () => {
  for (const width of [390, 1440]) {
    const time = createHarnessClock();
    renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
          <GameFrameScreenView
            {...props()}
            phase="configuring"
            record={null}
            setup={{
              viewerNotice: null,
              takeSeat: null,
              seats: [],
              privateSetup: null,
              options: null,
              start: {
                reason: null,
                hostStarts: false,
                readiness: { ready: true, blocked: false },
                canStart: true,
              },
            }}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    const preview = screen.getByTestId('custom-game-public');
    const start = screen.getByTestId('custom-game-start');
    // Paired with the Players card, which Start closes.
    const pair = preview.closest('[data-component="GameSectionPair"]');
    expect(pair).not.toBeNull();
    expect(pair?.contains(start)).toBe(true);
    expect(
      preview.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    cleanup();
  }
});

// regression: wide-setup-unbalanced — wide, a game being set up was a
// Players card beside a card holding only a small board preview, two short
// blocks at the top of the window. The preview's card also says how the
// game is played, in the game's own words; a phone keeps the slim preview.
test('wide: the card beside the players says how the game is played', () => {
  const RULES = 'Take turns dropping a disc into a column.';
  for (const width of [390, 1440]) {
    const time = createHarnessClock();
    renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
          <GameFrameScreenView
            {...props()}
            phase="configuring"
            record={null}
            about={() => RULES}
            setup={{
              viewerNotice: null,
              takeSeat: null,
              seats: [],
              privateSetup: null,
              options: null,
              start: {
                reason: null,
                hostStarts: false,
                readiness: { ready: true, blocked: false },
                canStart: true,
              },
            }}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    const about = screen.queryByTestId('custom-game-about');
    if (width === 390) expect(about).toBeNull();
    else {
      expect(about?.textContent).toBe(`How to play${RULES}`);
      // In the preview's own card, beside the Players card.
      const preview = screen.getByTestId('custom-game-public');
      expect(preview.parentElement?.contains(about)).toBe(true);
    }
    cleanup();
  }
});

// regression: battleship-own-seat-below-fold — on a 900px-tall window
// Battleship's turn line sat under the board, pushing the person's own seat
// ("Your move") below the fold. Beside a wide board during play the game's
// own line heads the record card instead; the plain `<Side> to move.` stays
// with the seat that says it.
test("wide: during play the game's own turn line heads the record card, not the board", () => {
  const time = createHarnessClock();
  const line = 'Red fleet fired at C4 and missed. Your turn to fire.';
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 1440, height: 900 }}
      >
        <GameFrameScreenView
          {...props()}
          status={{ ...props().status!, description: line }}
          record={{
            ...RECORD,
            turns: true,
            moves: ['a1', 'b2'],
            displayedPly: 2,
          }}
          table={{
            shape: 'strip',
            near: seat('white', 'avery'),
            others: [seat('black', 'jordan')],
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  const card = document.querySelector('[data-component="CustomGameReview"]');
  expect(card?.textContent).toContain(line);
  expect(
    screen
      .getByTestId('custom-game-status')
      .closest('[data-component="GameTurnPill"]')
      ?.getAttribute('data-spoken-only')
  ).toBe('true');
});

// regression: arena-commands-loose — on a phone a real-time game's Resign
// and History and stats sat as two loose links, one under the other. They
// share one actions row, as every game's commands do.
test('phone: a real-time game keeps Resign and its history in one actions row', () => {
  mount(390);
  const resign = screen.getByTestId('custom-game-resign');
  const history = screen.getByTestId('custom-game-history-stats');
  const row = resign.closest('[data-component="GameActions"]');
  expect(row).not.toBeNull();
  expect(row?.contains(history)).toBe(true);
});

// regression: arena-own-seat-unmarked — beside a wide arena the players'
// card listed every player alike, so the person could not tell which was
// theirs. Their own strip says "You".
// regression: light-cycles-you-badge-wraps — the "You" tag then sat on a
// line of its own under the name, so the person's strip stood taller than
// every other in the card. It sits on the name's own line, after it.
test("wide: the players' card tags the person's own strip You", () => {
  mount(1440);
  const own = screen.getByTestId('custom-game-white');
  expect(own.textContent).toContain('You');
  const name = screen.getByTestId('custom-game-white-person');
  const you = [...own.querySelectorAll('[data-component="Badge"]')].find(
    (badge) => badge.textContent === 'You'
  );
  expect(you).toBeDefined();
  expect(name.parentElement?.parentElement?.contains(you ?? null)).toBe(true);
  expect(screen.getByTestId('custom-game-black').textContent).not.toContain(
    'You'
  );
});

// regression: arena-scores-loud — beside a wide Light Cycles arena each
// player's round wins were large figures that competed with the arena. In
// the players' card each figure sits on one quiet line with its label.
test("wide: the players' card shows each figure on one quiet line", () => {
  mount(1440);
  const figure = screen
    .getByTestId('custom-game-white')
    .querySelector('[data-component="GameSeatStat"]');
  expect(figure?.textContent).toBe('Wins 0');
  expect(figure?.querySelector('.textStat')).toBeNull();
});
