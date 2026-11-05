import { afterEach, expect, test } from 'bun:test';
import { FrameRecordView } from '@libs/game-session-client-ts/game-frame-record-view';
import type { FrameRecord } from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
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
test("wide: the steps follow the moves as one group, and the game's commands are a card apart", () => {
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
  // The commands are not part of the record: their own card at the foot.
  const offer = screen.getByRole('button', { name: 'Offer draw' });
  expect(panel.contains(offer)).toBe(false);
  expect(
    offer
      .closest('[data-component="GameRailFoot"]')
      ?.getAttribute('data-testid')
  ).toBe('custom-game-rail-commands');
});

// regression: move-strip-chip-butts-arrow — under a phone's board the shown
// turn sat squeezed between four arrows, its marked move touching the next
// one, and "4 ● 3 ◆ 2" never said what its numbers were.
test('phone: the steps head the record and the shown turn has the strip to itself, in words', () => {
  mount(
    () => <FrameRecordView {...handlers} record={record()} layout="strip" />,
    390
  );
  const strip = screen.getByTestId('custom-game-move-strip');
  for (const step of [
    'custom-game-review-first',
    'custom-game-review-back',
    'custom-game-review-forward',
    'custom-game-review-live',
  ])
    expect(strip.contains(screen.getByTestId(step))).toBe(false);
  expect(strip.textContent).toContain('Move 5');
  expect(strip.textContent).toContain('col');
  // The move itself still reads exactly as the game writes it.
  expect(screen.getByTestId('custom-game-review-move-9').textContent).toBe('7');
  expect(screen.getByTestId('custom-game-review-move-10').textContent).toBe(
    '4'
  );
  const label = screen.getByTestId('custom-game-move-strip-label');
  const head = label.parentElement?.parentElement;
  expect(head?.contains(screen.getByTestId('custom-game-review-back'))).toBe(
    true
  );
});
