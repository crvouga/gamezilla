import { afterEach, describe, expect, test } from 'bun:test';
import type { CustomGamePlace } from '@libs/game-session-client-ts/custom-game-places';
import { FRAME_NO_PLAY } from '@libs/game-session-client-ts/game-frame-empty';
import type { FramePlay } from '@libs/game-session-client-ts/game-frame-view-types';
import type { StageOverlayEvent } from '@pkgs/turn-game-client-ts/stage-overlay';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import {
  frameProps,
  mountFrame,
  playSeat,
  record,
  status,
} from './frame-fixture';

afterEach(cleanup);

const shown = (id: string): boolean => screen.queryByTestId(id) !== null;

const stage = (): Element => {
  const found = document.querySelector('[data-space-row="stage"]');
  if (found === null) throw new Error('no stage');
  return found;
};

/** The labels of the action bar's controls, in order. */
function bar(): readonly string[] {
  const group = document.querySelector('[data-component="SpaceActionBar"]');
  return [...(group?.querySelectorAll('button') ?? [])].map(
    (button) => button.textContent ?? ''
  );
}

/** Three board actions: the bar is full without the viewer's standing. */
const BUSY_BOARD: FramePlay['boardActions'] = ['Play', 'Pass', 'Swap'].map(
  (label) => ({
    id: `board-${label.toLowerCase()}`,
    label,
    onPress: () => undefined,
    testId: `custom-game-board-${label.toLowerCase()}`,
  })
);

const over = (place: CustomGamePlace = { screen: 'result' }) =>
  frameProps({
    phase: 'completed',
    place,
    play: FRAME_NO_PLAY,
    status: status({
      description: 'Second side wins by resignation.',
      emphasis: 'neutral',
    }),
    next: { plays: true, canCreate: true, reviewable: true },
    result: {
      headline: 'You lost',
      note: 'You resigned.',
      scoreLabel: null,
      standings: [],
    },
  });

describe('a game in play', () => {
  test.each([390, 1440] as const)(
    'at %ipx the space frames it: the people, one status line, the board in the stage, the actions under it',
    (width) => {
      mountFrame(() => frameProps(), width);
      const content = screen.getByTestId('custom-game-content');
      expect(content.getAttribute('data-component')).toBe(
        'SpaceInGameTemplate'
      );
      expect(content.getAttribute('data-place')).toBe('play');
      expect(stage().contains(screen.getByTestId('custom-game-public'))).toBe(
        true
      );
      expect(screen.getByTestId('custom-game-status').textContent).toContain(
        'First side to move.'
      );
      expect(
        screen
          .getByTestId('custom-game-white-person')
          .getAttribute('aria-label')
      ).toContain('You');
      expect(shown('custom-game-black-person')).toBe(true);
      expect(bar()).toEqual(['Offer draw', 'Resign']);
    }
  );

  // regression: replay-controls-heavy-live
  // regression: phone-replay-steps-compete
  test('the live board has no steps through the moves: they are the moves place', () => {
    mountFrame(() => frameProps());
    for (const absent of [
      'custom-game-review-first',
      'custom-game-review-back',
      'custom-game-review-forward',
      'custom-game-review-live',
      'custom-game-review-ply',
    ])
      expect(shown(absent)).toBe(false);
  });

  // regression: arena-empty-status-pill — a real-time game's line may say
  // nothing of its own; a listener still hears who plays whom, and a
  // choice being sent takes the same line.
  test('an empty status line still says who plays whom; a choice being sent takes the same line', () => {
    const [sending, setSending] = createSignal(false);
    mountFrame(() =>
      frameProps({
        status: status({
          lineup: 'Left: Avery. Right: Jordan.',
          description: '',
          sending: sending(),
        }),
      })
    );
    const words = () => screen.getByTestId('custom-game-status');
    expect(words().textContent).toContain('Left: Avery. Right: Jordan.');
    expect(words().getAttribute('role')).toBe('status');
    setSending(true);
    expect(words().textContent).toContain('Sending choice…');
  });

  test('offering a draw is one press; resigning is confirmed first', () => {
    const chosen: unknown[] = [];
    const view = mountFrame(() =>
      frameProps({
        onChoose: async (input) => {
          chosen.push(input);
        },
      })
    );
    fireEvent.click(screen.getByTestId('custom-game-offer'));
    expect(chosen).toEqual([{ operation: 'offer' }]);
    fireEvent.click(screen.getByTestId('custom-game-resign'));
    expect(chosen).toHaveLength(1);
    expect(view.queryByRole('dialog')).not.toBeNull();
    expect(shown('custom-game-resign-confirm')).toBe(true);
  });

  test("with the bar full of the board's actions, offering a draw and resigning open from the viewer's own cell", () => {
    mountFrame(() =>
      frameProps({
        play: {
          ...FRAME_NO_PLAY,
          canOfferDraw: true,
          canResign: true,
          boardActions: BUSY_BOARD,
        },
      })
    );
    expect(bar()).toEqual(['Play', 'Pass', 'Swap']);
    expect(shown('custom-game-resign')).toBe(false);
    fireEvent.click(screen.getByTestId('custom-game-white-person'));
    expect(shown('custom-game-resign')).toBe(true);
    expect(shown('custom-game-offer')).toBe(true);
  });

  test('an answer the game waits for leads the bar', () => {
    mountFrame(() =>
      frameProps({
        play: {
          ...FRAME_NO_PLAY,
          drawOffered: true,
          canAnswerDraw: true,
          canResign: true,
        },
      })
    );
    expect(bar()).toEqual(['Accept draw', 'Decline draw', 'Resign']);
  });

  test('someone who may neither offer a draw nor resign is told what they wait for', () => {
    mountFrame(() => frameProps({ play: FRAME_NO_PLAY }));
    expect(shown('custom-game-offer')).toBe(false);
    expect(shown('custom-game-resign')).toBe(false);
    expect(bar()).toEqual([]);
  });

  test('the versus card lies over the stage with its count; a press skips to the board', () => {
    const sent: StageOverlayEvent[] = [];
    mountFrame(() =>
      frameProps({
        overlay: { kind: 'versus', count: 2 },
        onOverlay: (event) => sent.push(event),
      })
    );
    const versus = screen.getByTestId('custom-game-versus');
    expect(stage().contains(versus)).toBe(true);
    expect(versus.getAttribute('data-count')).toBe('2');
    expect(versus.textContent).toContain('jordan');
    fireEvent.click(screen.getByRole('button', { name: 'Start now' }));
    expect(sent).toEqual([{ type: 'skip' }]);
  });

  test('a timed seat shows its clock as its one figure', () => {
    mountFrame(() =>
      frameProps({
        table: {
          shape: 'strip',
          near: playSeat('white', 'avery', {
            clock: { value: '4:59', active: true },
          }),
          others: [playSeat('black', 'jordan')],
        },
      })
    );
    expect(screen.getByTestId('custom-game-white-clock').textContent).toBe(
      '4:59'
    );
  });

  test('the moves and the history open from the status line', () => {
    const opened: CustomGamePlace[] = [];
    mountFrame(() =>
      frameProps({
        record: record(['1', '2', '3']),
        onOpen: (place) => opened.push(place),
      })
    );
    expect(shown('custom-game-review-move-1')).toBe(false);
    fireEvent.click(screen.getByTestId('custom-game-commands'));
    expect(shown('custom-game-review-move-1')).toBe(true);
    expect(shown('custom-game-history-stats')).toBe(true);
    fireEvent.click(screen.getByTestId('custom-game-review-jump'));
    expect(opened).toEqual([{ screen: 'moves' }]);
  });
});

describe('watching a game in play', () => {
  // regression: watcher-rail-chip-says-you — a spectator saw another
  // person's seat marked as their own. The viewer is "You" only in their
  // own cell, which plays nothing and is marked watching.
  test('a watcher is "You" only in their own cell, and is told they are watching', () => {
    mountFrame(() =>
      frameProps({
        viewerSide: null,
        play: FRAME_NO_PLAY,
        table: {
          shape: 'strip',
          near: playSeat('white', 'jordan'),
          others: [playSeat('black', 'morgan')],
        },
      })
    );
    for (const seat of ['custom-game-white-person', 'custom-game-black-person'])
      expect(screen.getByTestId(seat).getAttribute('aria-label')).not.toContain(
        'You'
      );
    const own = screen.getByTestId('custom-game-you');
    expect(own.getAttribute('aria-label')).toContain('You');
    expect(own.getAttribute('data-status')).toBe('watching');
    expect(document.body.textContent).toContain("You're watching.");
  });
});

describe('a game that is over', () => {
  // regression: shared-board-terminal-buried
  // regression: completed-game-outcome-reason-missing
  // The outcome is the stage's status line, never over the final board,
  // and keeps the reason the game ended; the one rematch leads the bar.
  test.each([390, 1440] as const)(
    'at %ipx the outcome and its reason head the final board, with one rematch',
    (width) => {
      mountFrame(() => over(), width);
      const said = screen.getByTestId('custom-game-status');
      expect(said.textContent).toContain('You lost');
      expect(said.textContent).toContain('Second side wins by resignation.');
      expect(said.textContent).toContain('You resigned.');
      expect(screen.getByTestId('custom-game-public').contains(said)).toBe(
        false
      );
      expect(screen.getAllByTestId('custom-game-rematch')).toHaveLength(1);
      expect(bar()).toEqual(['Rematch', 'New game']);
    }
  );

  test('a player who may not start the next game can leave', () => {
    mountFrame(() => ({
      ...over(),
      next: { plays: true, canCreate: false, reviewable: true },
    }));
    expect(shown('custom-game-rematch')).toBe(false);
    expect(shown('custom-game-back')).toBe(true);
  });

  test('a watcher goes back to the space', () => {
    mountFrame(() => ({
      ...over(),
      viewerSide: null,
      next: { plays: false, canCreate: false, reviewable: true },
    }));
    expect(shown('custom-game-rematch')).toBe(false);
    expect(bar()).toEqual(['Back to the space']);
  });

  test('a cancelled game says so and offers the next one', () => {
    mountFrame(() => ({
      ...over(),
      phase: 'cancelled' as const,
      result: null,
      status: status({ description: 'Game cancelled.', emphasis: 'neutral' }),
    }));
    expect(screen.getByTestId('custom-game-status').textContent).toContain(
      'Game cancelled.'
    );
    expect(shown('custom-game-new')).toBe(true);
  });
});
