import { afterEach, describe, expect, test } from 'bun:test';
import type { CustomGamePlace } from '@libs/game-session-client-ts/custom-game-places';
import { FRAME_NO_PLAY } from '@libs/game-session-client-ts/game-frame-empty';
import type { StageOverlayEvent } from '@pkgs/turn-game-client-ts/stage-overlay';
import { useGameTableSeat } from '@pkgs/ui-root-client-ts/game-table-seat';
import { cleanup, fireEvent, screen, within } from '@solidjs/testing-library';
import {
  frameProps,
  mountFrame,
  playSeat,
  record,
  status,
} from './frame-fixture';

afterEach(cleanup);

const shown = (id: string): boolean => screen.queryByTestId(id) !== null;

/** Whether `first` comes before `second` in the document. */
function precedes(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  );
}

const stage = (): Element => {
  const found = document.querySelector('[data-component="GameBoardStage"]');
  if (found === null) throw new Error('no board stage');
  return found;
};

/** A game played in real time: no turns, so no moves. */
const REAL_TIME = record([], { turns: false });

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
      headline: 'You came 2nd',
      note: 'You resigned.',
      scoreLabel: null,
      standings: [],
    },
  });

describe('the play place', () => {
  // regression: replay-controls-heavy-live
  // regression: phone-replay-steps-compete
  // regression: game-rail-commands-detached
  // regression: game-rail-actions-ragged
  // regression: arena-commands-loose
  // The replay steps and the game's commands were moved around the board
  // and its rail five times. The play place holds neither: stepping
  // through the moves is the moves place, and the game menu holds every
  // command; the two a player reaches for mid-game (offer a draw, resign)
  // are also one press away in the bar under the board.
  test.each([390, 1440] as const)(
    'at %ipx it holds the board, the seats, one line and one way to the commands',
    (width) => {
      mountFrame(() => frameProps(), width);
      expect(shown('custom-game-seat-near')).toBe(true);
      expect(shown('custom-game-black')).toBe(true);
      expect(shown('custom-game-commands')).toBe(true);
      for (const absent of [
        'custom-game-review-first',
        'custom-game-review-back',
        'custom-game-review-forward',
        'custom-game-review-live',
        'custom-game-review-ply',
        'custom-game-resign',
        'custom-game-offer',
        'custom-game-cancel',
        'custom-game-history-stats',
      ])
        expect(shown(absent)).toBe(false);
    }
  );

  test('offering a draw and resigning are one press from the board; resigning is confirmed', () => {
    const chosen: unknown[] = [];
    const view = mountFrame(() =>
      frameProps({
        onChoose: async (input) => {
          chosen.push(input);
        },
      })
    );
    fireEvent.click(screen.getByTestId('custom-game-offer-draw'));
    expect(chosen).toEqual([{ operation: 'offer' }]);
    fireEvent.click(screen.getByTestId('custom-game-resign-now'));
    expect(chosen).toHaveLength(1);
    expect(view.queryByRole('dialog')).not.toBeNull();
  });

  test('someone who may neither offer a draw nor resign is shown neither', () => {
    mountFrame(() => frameProps({ play: FRAME_NO_PLAY }));
    expect(shown('custom-game-offer-draw')).toBe(false);
    expect(shown('custom-game-resign-now')).toBe(false);
  });

  test('the versus card lies over the board with its count; a press skips to the board', () => {
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
    expect(versus.textContent).toContain('avery');
    expect(versus.textContent).toContain('jordan');
    fireEvent.click(within(versus).getByRole('button', { name: 'Start now' }));
    expect(sent).toEqual([{ type: 'skip' }]);
  });

  // regression: battleship-own-seat-below-fold
  // regression: phone-game-status-buried
  // regression: frame-sending-chip-shifts-layout
  // The line about the turn sat between the board and the person's own
  // seat, pushing the seat below the fold, then in a strip, then in a rail
  // card. It leads the game's commands, said once, on every size.
  test.each([390, 1440] as const)(
    'at %ipx the one line about the game is outside the board stage, said once',
    (width) => {
      mountFrame(
        () =>
          frameProps({
            status: status({
              description: 'Red fleet fired at C4 and missed. Your turn.',
              plainTurn: false,
            }),
          }),
        width
      );
      const lines = screen.getAllByTestId('custom-game-status');
      expect(lines).toHaveLength(1);
      const line = lines[0] as HTMLElement;
      expect(stage().contains(line)).toBe(false);
      expect(precedes(stage(), line)).toBe(true);
      expect(line.textContent).toContain('Your turn.');
    }
  );

  test('a choice being sent is said in the same line, not a second one', () => {
    mountFrame(() =>
      frameProps({ status: status({ sending: true, plainTurn: false }) })
    );
    const lines = screen.getAllByTestId('custom-game-status');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.textContent).toContain('Sending choice…');
  });

  // regression: battleship-phone-strip-clips-move
  // regression: battleship-phone-strip-cramped
  // regression: phone-strip-two-moves-two-lines
  // regression: phone-strip-first-move-reflow
  // regression: move-strip-chip-butts-arrow
  // regression: phone-record-said-twice
  // A strip of the latest moves pinned above a phone's board was re-fitted
  // six times. Nothing about the moves sits above the board: they are one
  // card after it, so the board never moves when a move lands.
  test('phone: the moves are one card after the board, and nothing is pinned above it', () => {
    mountFrame(() => frameProps());
    expect(
      document.querySelector('[data-component="GameSessionPinned"]')
    ).toBeNull();
    const records = screen.getAllByTestId('custom-game-record');
    expect(records).toHaveLength(1);
    expect(precedes(stage(), records[0] as HTMLElement)).toBe(true);
    expect(shown('custom-game-move-strip')).toBe(false);
    expect(shown('custom-game-review-move-3')).toBe(true);
  });

  // regression: game-record-panel-stretched-empty
  test('wide: the moves card is as tall as its moves, never stretched to the board', () => {
    mountFrame(() => frameProps(), 1440);
    expect(
      screen.getByTestId('custom-game-record').getAttribute('data-fill')
    ).toBe('false');
  });

  // regression: phone-strip-empty-well
  // regression: unplayed-game-record-card
  test('before the first move the moves card says there are none yet', () => {
    mountFrame(() => frameProps({ record: record([]) }));
    expect(screen.getByTestId('custom-game-record').textContent).toContain(
      'No moves yet.'
    );
    expect(shown('custom-game-review-jump')).toBe(false);
  });

  // regression: hearts-record-card-only-a-sentence
  test('before the first move a game with steps ahead lists them, the one open now marked', () => {
    mountFrame(() =>
      frameProps({
        record: record([], {
          outline: [
            { label: 'Deal 1', detail: 'Pass left', current: true },
            { label: 'Deal 2', detail: 'Pass right', current: false },
          ],
        }),
      })
    );
    const outline = screen.getByTestId('custom-game-record-outline');
    expect(outline.textContent).toContain('Deal 1');
    expect(outline.textContent).toContain('Pass right');
    expect(outline.textContent?.match(/Now/g)).toHaveLength(1);
  });

  // regression: realtime-empty-game-record
  // regression: arena-rail-rows-misaligned
  // regression: arena-scores-loud
  // regression: arena-own-seat-unmarked
  // Beside a wide real-time arena the seats became a scoreboard card with
  // its own row rules. A real-time game has no moves card and no
  // scoreboard: its seats sit around the arena on every size, the person's
  // own nearest them.
  test.each([390, 1440] as const)(
    'at %ipx a real-time game has no moves card and its seats stay around the arena',
    (width) => {
      mountFrame(() => frameProps({ record: REAL_TIME }), width);
      expect(shown('custom-game-record')).toBe(false);
      expect(shown('custom-game-scoreboard')).toBe(false);
      const near = screen.getByTestId('custom-game-seat-near');
      expect(stage().contains(near)).toBe(true);
      expect(near.textContent).toContain('avery');
      expect(stage().contains(screen.getByTestId('custom-game-black'))).toBe(
        true
      );
    }
  );

  // regression: pong-panel-repeats-hint
  test("a real-time game's default line is for a listener only", () => {
    mountFrame(() =>
      frameProps({
        record: REAL_TIME,
        status: status({
          description: 'Game in progress.',
          emphasis: 'neutral',
        }),
      })
    );
    const line = screen.getByTestId('custom-game-status');
    expect(
      line.closest('[data-component="VisuallyHidden"]') ??
        line.querySelector('[data-component="VisuallyHidden"]')
    ).not.toBeNull();
  });

  // regression: pong-status-reads-as-button
  test('a real-time game says how play goes on as plain hint text, not a pill', () => {
    mountFrame(() =>
      frameProps({
        record: REAL_TIME,
        status: status({
          description: 'Round 2 · first to 3',
          plainTurn: false,
          emphasis: 'neutral',
        }),
      })
    );
    const pill = screen
      .getByTestId('custom-game-status')
      .closest('[data-component="GameTurnPill"]');
    expect(pill?.getAttribute('data-look')).toBe('plain');
    expect(pill?.querySelector('.bg-surface-muted')).toBeNull();
  });

  // regression: phone-player-rail-clipped
  test('phone: at a bigger table every player shows above the board, the person first', () => {
    mountFrame(() =>
      frameProps({
        record: REAL_TIME,
        playerCount: 3,
        table: {
          shape: 'rail',
          near: playSeat('white', 'avery'),
          others: [playSeat('black', 'jordan'), playSeat('red', 'morgan')],
        },
      })
    );
    const rail = document.querySelector('[data-component="GamePlayerRail"]');
    const chips = Array.from(
      rail?.querySelectorAll('[data-component="GamePlayerChip"]') ?? []
    );
    expect(chips).toHaveLength(3);
    expect(chips[0]?.textContent).toContain('You');
  });

  // regression: pong-phone-players-named-thrice
  test('phone: a board that names its players draws no seat above or below it', () => {
    mountFrame(() =>
      frameProps({
        record: REAL_TIME,
        table: {
          shape: 'strip',
          named: true,
          near: playSeat('white', 'avery'),
          others: [playSeat('black', 'jordan')],
        },
      })
    );
    expect(shown('custom-game-seat-near')).toBe(false);
    expect(shown('custom-game-black')).toBe(false);
  });

  // regression: hearts-seats-shown-twice
  test('a board that seats its players is lent each player and no seat is drawn around it', () => {
    const Seated = () => {
      const lend = useGameTableSeat();
      const player = lend?.('black');
      expect(player?.name).toBe('jordan');
      expect(lend?.('blue').name).toBeNull();
      return <>{player?.content}</>;
    };
    mountFrame(() => ({
      ...frameProps({
        table: {
          shape: 'board',
          near: playSeat('white', 'avery'),
          others: [playSeat('black', 'jordan'), playSeat('red', 'morgan')],
        },
      }),
      // Made where the frame mounts it, inside the table that lends seats.
      get board() {
        return <Seated />;
      },
    }));
    expect(
      document.querySelector('[data-component="GamePlayerRail"]')
    ).toBeNull();
    expect(shown('custom-game-seat-near')).toBe(false);
    const lent = screen.getByTestId('custom-game-black');
    expect(lent.getAttribute('data-component')).toBe('GameTableSeat');
    expect(screen.getAllByTestId('custom-game-black')).toHaveLength(1);
    // regression: hearts-seat-dots-unexplained
    expect(lent.querySelector('[data-component="GameSeatSwatch"]')).toBeNull();
  });

  test('an answer the game is waiting for is asked on the board, not behind the menu', () => {
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
    expect(shown('custom-game-agree')).toBe(true);
    expect(shown('custom-game-reject')).toBe(true);
  });

  test('pressing a move opens the moves place at it and never rewinds the live board', () => {
    const calls: string[] = [];
    mountFrame(() =>
      frameProps({
        onSeek: (ply) => calls.push(`seek ${String(ply)}`),
        onOpen: (place) => calls.push(`open ${place.screen}`),
      })
    );
    fireEvent.click(screen.getByTestId('custom-game-review-move-2'));
    expect(calls).toEqual(['seek 2', 'open moves']);
  });

  test('a watcher with nothing to command is offered no game menu', () => {
    mountFrame(() =>
      frameProps({
        viewerSide: null,
        play: FRAME_NO_PLAY,
        record: record(['1'], { history: false }),
      })
    );
    expect(shown('custom-game-commands')).toBe(false);
    expect(shown('custom-game-watching')).toBe(true);
  });
});

describe('the game menu', () => {
  // regression: history-link-moves-around
  // "History and stats" sat at the record's title, in its disclosure, and
  // beside Resign. During play it is one row of the game menu.
  test('holds every command as a row, History and stats among them, once', () => {
    mountFrame(() => frameProps({ place: { screen: 'commands' } }));
    for (const row of [
      'custom-game-offer',
      'custom-game-review-moves',
      'custom-game-history-stats',
      'custom-game-resign',
      'custom-game-resume',
    ])
      expect(screen.getAllByTestId(row)).toHaveLength(1);
    expect(
      document.querySelector('[data-component="GameBoardStage"]')
    ).toBeNull();
  });

  test('a draw that may not be offered yet says when it may', () => {
    mountFrame(() =>
      frameProps({
        place: { screen: 'commands' },
        play: { ...FRAME_NO_PLAY, offerAgainLater: true, canResign: true },
      })
    );
    const offer = screen.getByTestId('custom-game-offer');
    expect(offer).toBeDisabled();
    expect(offer.textContent).toContain(
      'You may offer again after your next move.'
    );
  });
});

describe('the moves place', () => {
  test('shows the board at one position, the four steps under it and every move', () => {
    const sought: number[] = [];
    mountFrame(() =>
      frameProps({
        place: { screen: 'moves' },
        record: record(['1', '2', '3'], { displayedPly: 2 }),
        onSeek: (ply) => sought.push(ply),
      })
    );
    expect(screen.getByTestId('custom-game-reviewing').textContent).toContain(
      'After move 2 of 3'
    );
    fireEvent.click(screen.getByTestId('custom-game-review-back'));
    fireEvent.click(screen.getByTestId('custom-game-review-forward'));
    fireEvent.click(screen.getByTestId('custom-game-review-first'));
    expect(sought).toEqual([1, 3, 0]);
    expect(shown('custom-game-review-move-1')).toBe(true);
    // It never plays: no seat to move, no command of the game.
    expect(shown('custom-game-seat-near')).toBe(false);
    expect(shown('custom-game-commands')).toBe(false);
  });

  test('a move that was not played is refused in words, with the field still there', () => {
    mountFrame(() =>
      frameProps({
        place: { screen: 'moves' },
        record: record(['1', '2'], {
          displayedPly: 1,
          error: 'Choose a position from the moves actually played.',
        }),
      })
    );
    expect(screen.getByTestId('custom-game-error').textContent).toContain(
      'Choose a position from the moves actually played.'
    );
    expect(shown('custom-game-review-ply')).toBe(true);
  });

  test('the way back leads to the game while it is played and to the result once it is over', () => {
    mountFrame(() => frameProps({ place: { screen: 'moves' } }));
    expect(screen.getByTestId('custom-game-back-to-live').textContent).toBe(
      'Back to the game'
    );
    cleanup();
    mountFrame(() => over({ screen: 'moves' }));
    expect(screen.getByTestId('custom-game-back-to-live').textContent).toBe(
      'Back to the result'
    );
  });
});

describe('the result place', () => {
  // regression: shared-board-terminal-buried
  // The outcome is never under the board: it lies over it, and the one
  // rematch is a command of the bar, so neither moves the board.
  test.each([390, 1440] as const)(
    'at %ipx the outcome lies over the final board, with one real rematch',
    (width) => {
      mountFrame(() => over(), width);
      const headline = screen.getByTestId('custom-game-result-headline');
      const rematch = screen.getAllByTestId('custom-game-rematch');
      expect(rematch).toHaveLength(1);
      expect(stage().contains(headline)).toBe(true);
      expect(stage().contains(rematch[0] as HTMLElement)).toBe(false);
      expect(screen.getAllByTestId('custom-game-history-stats')).toHaveLength(
        1
      );
      expect(document.body.textContent).not.toContain('Live');
      expect(
        document.querySelectorAll('button[data-variant="solid"]')
      ).toHaveLength(1);
    }
  );

  // regression: completed-game-outcome-reason-missing
  test('the result keeps the reason the game ended', () => {
    mountFrame(() => over());
    expect(screen.getByTestId('custom-game-outcome').textContent).toContain(
      'Second side wins by resignation.'
    );
    expect(screen.getByTestId('custom-game-outcome').textContent).toContain(
      'You resigned.'
    );
  });

  test('the result card is closed to see the board and opened again from the bar', () => {
    const sent: StageOverlayEvent[] = [];
    mountFrame(() => ({
      ...over(),
      onOverlay: (event) => sent.push(event),
    }));
    expect(shown('custom-game-show-result')).toBe(false);
    fireEvent.click(screen.getByTestId('game-result-overlay-dismiss'));
    expect(sent).toEqual([{ type: 'dismiss' }]);
    cleanup();
    mountFrame(() => ({
      ...over(),
      overlay: { kind: 'board' as const },
      onOverlay: (event) => sent.push(event),
    }));
    // Closed, the board shows; the headline stays, as the way back.
    expect(shown('custom-game-outcome')).toBe(false);
    const reopen = screen.getByTestId('custom-game-show-result');
    expect(reopen.textContent).toContain('You came 2nd');
    fireEvent.click(reopen);
    expect(sent).toEqual([{ type: 'dismiss' }, { type: 'show' }]);
  });

  test('a watcher goes back to the space or looks at the moves', () => {
    mountFrame(() => ({
      ...over(),
      viewerSide: null,
      next: { plays: false, canCreate: false, reviewable: true },
    }));
    expect(shown('custom-game-rematch')).toBe(false);
    expect(shown('custom-game-back')).toBe(true);
    expect(shown('custom-game-review-start')).toBe(true);
  });

  test('a cancelled game says so and offers the next one', () => {
    mountFrame(() => ({
      ...over(),
      phase: 'cancelled' as const,
      result: null,
      status: status({ description: 'Game cancelled.', emphasis: 'neutral' }),
    }));
    expect(
      screen.getByTestId('custom-game-result-headline').textContent
    ).toContain('Game cancelled.');
    expect(shown('custom-game-new')).toBe(true);
  });
});
