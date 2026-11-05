import { afterEach, expect, test } from 'bun:test';
import { FrameRecordView } from '@libs/game-session-client-ts/game-frame-record-view';
import { FrameSetupSeatsView } from '@libs/game-session-client-ts/game-frame-seats-view';
import type {
  FrameRecord,
  FrameSetupSeat,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

const RED = { sideLabel: 'Red circle', swatch: { mark: '●' } };
const YELLOW = { sideLabel: 'Yellow diamond', swatch: { mark: '◆' } };

/** Ten drops, five each, Red to move: a game's middle. */
function record(): FrameRecord {
  const moves = ['4', '4', '3', '5', '5', '6', '3', '2', '7', '4'];
  return {
    earlier: [],
    selection: 'live',
    turns: true,
    moves,
    perTurn: 2,
    movers: moves.map((_, index) => (index % 2 === 0 ? RED : YELLOW)),
    movePrefix: 'col',
    displayedPly: moves.length,
    error: '',
    history: true,
  };
}

/** Mounts `ui` with the theme and virtual time the design system needs. */
function mount(ui: () => JSX.Element, width: number): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
        {ui()}
      </ThemeProvider>
    </ClockProvider>
  ));
}

const handlers = {
  onSeek: () => undefined,
  onReturnLive: () => undefined,
  onSelectRecord: () => undefined,
  onOpenHistory: () => undefined,
};

// regression: game-record-panel-stretched-empty — beside a wide board the
// record ran the board's height: its moves at the top, about 300px of
// nothing, then the steps and Offer draw / Resign pinned to its foot.
// regression: game-rail-commands-detached — the fix moved Offer draw /
// Resign into a card of their own pinned to the board's foot, leaving about
// 200px of empty rail between it and the record.
test("wide: the steps follow the moves, and the game's commands close the same card right under them", () => {
  mount(
    () => (
      <FrameRecordView
        {...handlers}
        record={record()}
        layout="panel"
        commands={<button type="button">Offer draw</button>}
      />
    ),
    1440
  );
  const panel = document.querySelector(
    'section[data-component="CustomGameReview"]'
  );
  if (panel === null) throw new Error('No record panel');
  // As tall as what it holds: never stretched to the board's foot.
  expect(panel.getAttribute('data-fill')).toBe('false');
  // The steps sit right under the moves, in one group.
  const list = document.querySelector('[data-component="GameMoveList"]');
  const steps = list?.nextElementSibling;
  for (const step of [
    'custom-game-review-first',
    'custom-game-review-back',
    'custom-game-review-forward',
    'custom-game-review-live',
  ])
    expect(steps?.contains(screen.getByTestId(step))).toBe(true);
  // The commands are the record card's own foot, after the steps: one
  // card, no second card pinned apart from it.
  const offer = screen.getByRole('button', { name: 'Offer draw' });
  expect(panel.contains(offer)).toBe(true);
  expect(document.querySelector('[data-component="GameRailFoot"]')).toBeNull();
  const back = screen.getByTestId('custom-game-review-back');
  expect(
    back.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  // Jumping to a move by number is a quiet toggle beside the steps.
  const jump = screen.getByTestId('custom-game-review-jump');
  expect(steps?.contains(jump)).toBe(true);
  expect(jump.getAttribute('aria-expanded')).toBe('false');
});

// regression: move-strip-chip-butts-arrow — under a phone's board the shown
// turn sat squeezed between four arrows, its marked move touching the next
// one, and "4 ● 3 ◆ 2" never said what its numbers were.
// regression: phone-replay-steps-compete — the four steps then headed the
// record during live play, competing with the board and the game's
// commands. While live they wait behind the record's chevron.
test('phone: the shown turn has the strip to itself, in words; the steps wait behind the chevron while live', () => {
  mount(
    () => <FrameRecordView {...handlers} record={record()} layout="strip" />,
    390
  );
  const strip = screen.getByTestId('custom-game-move-strip');
  expect(strip.textContent).toContain('Move 5');
  expect(strip.textContent).toContain('col');
  // The move itself still reads exactly as the game writes it.
  expect(screen.getByTestId('custom-game-review-move-9').textContent).toBe('7');
  expect(screen.getByTestId('custom-game-review-move-10').textContent).toBe(
    '4'
  );
  expect(screen.queryByTestId('custom-game-review-back')).toBeNull();
  fireEvent.click(screen.getByTestId('custom-game-review-jump'));
  const steps = screen.getByTestId('custom-game-record-steps');
  for (const step of [
    'custom-game-review-first',
    'custom-game-review-back',
    'custom-game-review-forward',
    'custom-game-review-live',
  ]) {
    expect(strip.contains(screen.getByTestId(step))).toBe(false);
    expect(steps.contains(screen.getByTestId(step))).toBe(true);
  }
});

// regression: phone-record-said-twice — under a phone's board a "Moves ·
// Live" strip and a separate "Game record" accordion showed the same moves
// as two units, and "Live" beside "Moves" read as a cryptic label.
test('phone: the record is one card that says whether it is live and opens in place', () => {
  mount(
    () => <FrameRecordView {...handlers} record={record()} layout="strip" />,
    390
  );
  const card = screen
    .getByTestId('custom-game-move-strip')
    .closest('[data-testid="custom-game-record"]');
  if (card === null) throw new Error('No record card');
  const toggle = screen.getByTestId('custom-game-review-jump');
  expect(card.contains(toggle)).toBe(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('Game record')).toBeNull();
  expect(screen.getByTestId('custom-game-move-strip-place').textContent).toBe(
    'Live'
  );
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(card.contains(screen.getByTestId('custom-game-review-live'))).toBe(
    true
  );
  // The way to the history is with the game's commands, not in the strip.
  expect(screen.queryByTestId('custom-game-history-stats')).toBeNull();
});

test('phone: an earlier move reads as being reviewed, with its number', () => {
  mount(
    () => (
      <FrameRecordView
        {...handlers}
        record={{ ...record(), displayedPly: 3 }}
        layout="strip"
      />
    ),
    390
  );
  expect(screen.getByTestId('custom-game-move-strip-place').textContent).toBe(
    'Reviewing move 3 of 10'
  );
  // Reviewing, the steps come out beside the place shown.
  const steps = screen.getByTestId('custom-game-record-steps');
  expect(steps.contains(screen.getByTestId('custom-game-review-live'))).toBe(
    true
  );
  expect(
    steps.contains(screen.getByTestId('custom-game-move-strip-place'))
  ).toBe(true);
});

const AVERY: FrameSetupSeat = {
  side: 'red',
  sideLabel: 'Red circle',
  holder: { kind: 'person', person: 'avery' },
  plainName: 'avery',
  swatch: { mark: '●' },
  clock: null,
  host: true,
  visiting: false,
  own: true,
  ready: true,
  invitation: null,
  canSit: false,
  canLeave: true,
  choices: {
    localPlayers: true,
    bots: true,
    difficulties: [],
    difficulty: undefined,
    invitees: null,
  },
};
const BOT: FrameSetupSeat = {
  ...AVERY,
  side: 'blue',
  sideLabel: 'Yellow diamond',
  holder: { kind: 'bot', level: 'medium' },
  plainName: 'Bot (medium)',
  swatch: { mark: '◆' },
  host: false,
  own: false,
};

function seats(width: number): void {
  mount(
    () => (
      <FrameSetupSeatsView
        setup={{
          viewerNotice: null,
          takeSeat: null,
          seats: [AVERY, BOT],
          privateSetup: null,
          options: null,
          start: {
            reason: null,
            hostStarts: false,
            readiness: { ready: true, blocked: false },
            canStart: true,
          },
        }}
        onChoose={() => Promise.resolve()}
        ownReadiness={<button type="button">I'm not ready</button>}
      />
    ),
    width
  );
}

// regression: setup-player-controls-scattered — wide, "Change player" sat
// about 450px from its player at the row's far edge while "I'm not ready"
// sat on a line of its own under the name, in a half-empty card.
// regression: setup-seats-nested-cards — each seat was then a bordered card
// inside the Players card, and a bot said "Ready" though it always is and
// the game never waits for it. The seats are one plain list of player rows,
// and only a person's seat says whether they are ready.
test('setup: the players are one plain list, each row holding its identity, readiness and controls', () => {
  for (const width of [390, 1440]) {
    seats(width);
    const avery = screen.getByTestId('custom-game-red');
    const toggle = screen.getByTestId('custom-game-red-choices');
    const notReady = screen.getByRole('button', { name: "I'm not ready" });
    // The toggle and the seat's own control share one line under the name.
    expect(toggle.parentElement?.contains(notReady)).toBe(true);
    expect(toggle.parentElement?.contains(screen.getByText('avery'))).toBe(
      false
    );
    // No card inside the card: the rows sit straight in one list.
    const list = screen.getByTestId('custom-game-setup-seats');
    expect(avery.parentElement).toBe(list);
    expect(screen.getByTestId('custom-game-blue').parentElement).toBe(list);
    expect(list.querySelector('[data-component="Surface"]')).toBeNull();
    // The person says they are ready; the bot says nothing about it.
    const readiness = (side: string) =>
      screen
        .getByTestId(`custom-game-${side}`)
        .querySelector('[data-component="GameSeatReadiness"]');
    expect(readiness('red')?.textContent).toContain('Ready');
    expect(readiness('blue')).toBeNull();
    cleanup();
  }
});

// regression: replay-controls-heavy-live — during live play the record's
// four steps were filled discs that outweighed the board and the game's
// commands. They are quiet glyphs while the board is live, and take their
// plates only while an earlier position is reviewed.
test('the steps are quiet during live play and plated while reviewing', () => {
  const plated = (): boolean[] =>
    [
      'custom-game-review-first',
      'custom-game-review-back',
      'custom-game-review-forward',
      'custom-game-review-live',
    ].map(
      (id) =>
        !screen
          .getByTestId(id)
          .innerHTML.includes('background-color: transparent')
    );
  mount(
    () => <FrameRecordView {...handlers} record={record()} layout="panel" />,
    1440
  );
  expect(plated()).toEqual([false, false, false, false]);
  cleanup();
  mount(
    () => (
      <FrameRecordView
        {...handlers}
        record={{ ...record(), displayedPly: 4 }}
        layout="panel"
      />
    ),
    1440
  );
  expect(plated()).toEqual([true, true, true, true]);
});

// regression: setup-start-far-from-players — wide, the Players card held a
// 300px list of seats in a 670px card, so a wide empty band lay between
// the seats' controls and Start at the card's far edge.
// regression: setup-desktop-top-strip — the seats then sat two to a row in
// a 290px strip across the top of the page beside a small preview. The
// Players card is now an equal column beside the board preview (see
// game-surfaces-balance), so on every size its seats are one plain list,
// one seat to a row, with Start closing the card under them.
test('setup: the seats are one list, one seat to a row, on every size', () => {
  for (const width of [1440, 390]) {
    seats(width);
    const list = screen.getByTestId('custom-game-setup-seats');
    expect(list.className).not.toContain('grid-cols-2');
    expect(list.getAttribute('data-component')).toBe('StackVertical');
    expect(screen.getByTestId('custom-game-red').parentElement).toBe(list);
    cleanup();
  }
});
