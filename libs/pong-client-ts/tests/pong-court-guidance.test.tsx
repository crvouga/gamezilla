/** Pong's court guidance, status words and naming, as a player meets them. */

import { afterEach, expect, test } from 'bun:test';
import { PongBoardView } from '@libs/pong-client-ts/pong-board-view';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  initialPongState,
  type PongState,
} from '@libs/pong-shared-ts/pong-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const realMatchMedia = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
});

/** A device that can (or cannot) hover with a fine pointer. */
function pointer(hover: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: hover && query.includes('hover: hover'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

const start = initialPongState(pongConfig(), () => 0);

function mount(options: {
  width?: number;
  sides?: readonly GameSide[];
  state?: PongState;
  position?: string;
  stale?: boolean;
}) {
  const inputs: unknown[] = [];
  const [position, setPosition] = createSignal(
    options.position ?? pongPositionCodec.encode(options.state ?? start)
  );
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: options.width ?? 390, height: 844 }}
    >
      <PongBoardView
        seats={[
          { side: 'white', look: { color: 1 }, name: 'avery' },
          { side: 'black', look: { color: 2 }, name: 'jordan_plays' },
        ]}
        position={position()}
        orientation="white"
        interactive={true}
        sound={false}
        syncKey={0}
        testId="pong"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => undefined}
        simulation={{
          paused: false,
          stale: options.stale ?? false,
          sides: options.sides ?? ['white'],
          onInput: (side, input) => inputs.push([side, input]),
          onRelease: () => undefined,
        }}
      />
    </ThemeProvider>
  ));
  return { ...view, inputs, setPosition };
}

// regression: pong-keys-need-court-focus — arrow keys did nothing until the
// player found the court in the tab order (6–10 presses).
test('a paddle key pressed with nothing focused moves the paddle and focuses the court', () => {
  const view = mount({});
  fireEvent.keyDown(document.body, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(view.getByRole('application'));
  expect(view.inputs).toEqual([['white', { kind: 'direction', direction: 1 }]]);
});

test('keys typed into another control stay there', () => {
  const view = mount({});
  const other = document.createElement('input');
  document.body.append(other);
  other.focus();
  fireEvent.keyDown(other, { key: 'ArrowDown' });
  expect(view.inputs).toEqual([]);
  other.remove();
});

// regression: pong-narrow-keys-undisclosed — below the wide layout the
// guidance only said "Drag" although the keys work.
test('a narrow screen with a mouse names the keys beside the drag', () => {
  pointer(true);
  mount({ width: 768 });
  expect(
    screen.getByText(
      /Drag up and down anywhere on the court\. W and S or the arrow keys move your paddle\./
    )
  ).toBeTruthy();
});

test('a touch-only phone keeps the drag guidance alone', () => {
  pointer(false);
  mount({ width: 390 });
  expect(
    screen.getByText(/Drag up and down anywhere on the court\./)
  ).toBeTruthy();
  expect(screen.queryByText(/arrow keys/)).toBeNull();
});

// regression: pong-status-omits-scorer-and-match-point — a serve after a
// point looked the same as any serve, and match point was never said.
test('the serve after a point names who scored and match point', () => {
  const view = mount({
    state: {
      ...start,
      score: { left: 1, right: 2 },
      feedback: { ...start.feedback, points: 3 },
      targetScore: 3,
      // After a point the serve goes toward the side that lost it.
      servingToward: 'left',
    },
  });
  const status = view.getByRole('status');
  expect(status.textContent).toMatch(
    /^jordan_plays scored · Match point · Serve in \d+$/
  );
  expect(status.getAttribute('data-stage')).toBe('countdown');
  view.setPosition(
    pongPositionCodec.encode({
      ...start,
      score: { left: 1, right: 0 },
      feedback: { ...start.feedback, points: 1 },
      targetScore: 3,
      servingToward: 'right',
    })
  );
  expect(view.getByRole('status').textContent).toMatch(
    /^You scored · Serve in \d+$/
  );
});

// regression: pong-finished-court-repeats-winner — the court said "Right
// wins." under a heading that already named the winner.
test('a finished court shows the final score and carries the winner as data', () => {
  const view = mount({
    state: {
      ...start,
      phase: 'completed',
      countdown: 0,
      score: { left: 0, right: 3 },
      feedback: { ...start.feedback, points: 3 },
      targetScore: 3,
      winner: 'right',
    },
  });
  const status = view.getByRole('status');
  expect(status.textContent).toBe('Final score 0–3');
  expect(status.getAttribute('data-stage')).toBe('finished');
  expect(status.getAttribute('data-winner')).toBe('right');
});

// regression: pong-reconnecting-status-repeats-caption — the court and the
// caption under it said the same thing about controls.
test('reconnecting says so once on the court, and the caption says what it means for controls', () => {
  const view = mount({ stale: true });
  expect(view.getByRole('status').textContent).toBe('Reconnecting…');
  expect(view.getByRole('status').getAttribute('data-stage')).toBe(
    'reconnecting'
  );
  expect(
    screen.getByText(/Controls are unavailable until play resumes\./)
  ).toBeTruthy();
});

// regression: pong-two-players-sides-unnamed — two players on one device
// were "Left player" and "Right player" beside a Players card naming them.
test('two players on one device are named on the scoreboard', () => {
  const view = mount({ sides: ['white', 'black'] });
  const board = view.getByTestId('pong-scoreboard');
  expect(board.textContent).toContain('avery');
  expect(board.textContent).toContain('jordan_plays');
  expect(board.textContent).not.toContain('Left player');
});

// regression: pong-unreadable-resign-unexplained — Resign stayed beside
// "Pong could not be opened" with nothing saying why.
test('a seated player who cannot open the game is told resigning ends it', () => {
  const view = mount({ position: 'pong:broken' });
  expect(view.getByRole('alert').textContent).toContain(
    'Return to your spaces, or resign to end this game.'
  );
});
