import { afterEach, describe, expect, test } from 'bun:test';
import type { CustomGamePlace } from '@libs/game-session-client-ts/custom-game-places';
import { FRAME_NO_PLAY } from '@libs/game-session-client-ts/game-frame-empty';
import type { FramePhase } from '@libs/game-session-client-ts/game-frame-view-types';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import {
  frameProps,
  HOST_CHOICES,
  hostSetup,
  mountFrame,
  setupProps,
  setupSeat,
} from './frame-fixture';

afterEach(cleanup);

/** The filled commands a person could press now. */
function filled(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'button[data-variant="solid"]:not([disabled])'
    )
  );
}

const shown = (id: string): boolean => screen.queryByTestId(id) !== null;

describe('before a game', () => {
  test('the start place offers the two ways to begin as rows, and nothing else', () => {
    mountFrame(() =>
      frameProps({ phase: 'none', place: { screen: 'start' }, status: null })
    );
    expect(shown('custom-game-play-bot')).toBe(true);
    expect(shown('custom-game-create')).toBe(true);
    expect(
      document.querySelector('[data-component="GameBoardStage"]')
    ).toBeNull();
    // A listener still hears there is no game.
    expect(screen.getByTestId('custom-game-status').textContent).toContain(
      'No Custom Game.'
    );
  });

  test('someone who may not create a game is told who will', () => {
    mountFrame(() =>
      frameProps({
        phase: 'none',
        place: { screen: 'start' },
        canCreate: false,
      })
    );
    expect(shown('custom-game-create')).toBe(false);
    expect(
      screen.getByText('Waiting for the creator to create a game.')
    ).toBeTruthy();
  });
});

describe('the lobby', () => {
  // regression: setup-preview-below-start
  // regression: phone-setup-preview-uninformative
  // regression: setup-preview-tiny
  // regression: setup-how-to-play-misaligned
  // regression: wide-setup-unbalanced
  // regression: setup-desktop-top-strip
  // regression: lobby-board-preview-missing
  // The setup's board preview and its "How to play" card were rearranged
  // seven times, then left out, so nobody saw which way their board faced
  // before the game started. The lobby is one column on every size: a
  // small, labelled thumbnail of the game's board heading the players, then
  // what is agreed and starting. It is never the live board, never a card
  // of its own and never beside the seats.
  test.each([390, 1440] as const)(
    'at %ipx the lobby heads the players with a small board preview, in one column',
    (width) => {
      mountFrame(() => setupProps(), width);
      const stages = document.querySelectorAll(
        '[data-component="GameBoardStage"]'
      );
      expect(stages).toHaveLength(1);
      const stage = stages[0] as HTMLElement;
      expect(stage.dataset['testid']).toBe('custom-game-preview');
      expect(stage.dataset['preview']).toBe('true');
      expect(stage.textContent).toContain('Board preview');
      // The game's preview board, never the live one or its public state.
      expect(shown('story-board-preview')).toBe(true);
      expect(shown('story-board')).toBe(false);
      expect(shown('custom-game-public')).toBe(false);
      expect(shown('custom-game-about')).toBe(false);
      expect(
        document.querySelector('[data-component="GameSection"]')
      ).toBeNull();
      // Above the players and Start, in the lobby's one column.
      const seats = screen.getByTestId('custom-game-setup-seats');
      const start = screen.getByTestId('custom-game-start');
      for (const after of [seats, start])
        expect(
          stage.compareDocumentPosition(after) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      expect(stage.parentElement).toBe(seats.parentElement);
    }
  );

  test('a game drawn without a board shows no preview', () => {
    mountFrame(() =>
      setupProps({ screen: 'lobby' }, { boardPreview: undefined })
    );
    expect(
      document.querySelector('[data-component="GameBoardStage"]')
    ).toBeNull();
  });

  // regression: setup-seats-nested-cards
  // regression: setup-player-controls-scattered
  // regression: setup-start-far-from-players
  test.each([390, 1440] as const)(
    'at %ipx the seats are one list of rows, Start after them in the same column',
    (width) => {
      mountFrame(() => setupProps(), width);
      const seats = screen.getByTestId('custom-game-setup-seats');
      const rows = seats.querySelectorAll('[data-component="MenuRow"]');
      expect(rows).toHaveLength(2);
      // One list: no card inside the card, and no control scattered in a row.
      expect(seats.querySelector('[data-component="GameSection"]')).toBeNull();
      expect(seats.querySelector('[data-component="Button"]')).toBeNull();
      const start = screen.getByTestId('custom-game-start');
      expect(
        seats.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      // A bot is always ready and never what the game waits for.
      expect(rows[1]?.textContent).not.toContain('Ready');
      expect(rows[0]?.textContent).toContain('Ready');
    }
  );

  test('a seat the viewer may change opens its own place; one they may not only reads', () => {
    const opened: CustomGamePlace[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          onOpen: (place) => opened.push(place),
          setup: hostSetup({
            seats: [
              setupSeat('white', { kind: 'person', person: 'a' }, 'avery', {
                host: true,
              }),
              setupSeat('black', { kind: 'open' }, 'Open place', {
                choices: HOST_CHOICES,
              }),
            ],
          }),
        }
      )
    );
    expect(shown('custom-game-white-choices')).toBe(false);
    expect(screen.getByTestId('custom-game-white').tagName).not.toBe('BUTTON');
    fireEvent.click(screen.getByTestId('custom-game-black-choices'));
    expect(opened).toEqual([{ screen: 'seat', side: 'black' }]);
  });

  test('what is agreed sits behind its own row, each saying what is chosen', () => {
    const opened: CustomGamePlace[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          onOpen: (place) => opened.push(place),
          setup: hostSetup({
            privateSetup: { complete: false, locked: false },
            options: {
              players: null,
              groups: [
                {
                  kind: 'count',
                  id: 'rounds',
                  label: () => 'Rounds',
                  min: 1,
                  max: 5,
                  default: 3,
                  read: () => 3,
                  encode: (value) => `rounds:${String(value)}`,
                },
              ],
              position: 'fixture',
              editable: true,
              clock: { minutes: 5, increment: 3 },
            },
          }),
        }
      )
    );
    expect(screen.getByTestId('custom-game-rules').textContent).toContain('3');
    expect(screen.getByTestId('custom-game-options').textContent).toContain(
      '5+3'
    );
    // The row shows one word; a listener hears the whole sentence.
    expect(screen.getByTestId('custom-game-setup-status').textContent).toBe(
      'Your private setup is incomplete.'
    );
    // Nothing is changed on the lobby itself.
    expect(shown('custom-game-minutes')).toBe(false);
    expect(shown('custom-game-setup-random')).toBe(false);
    fireEvent.click(screen.getByTestId('custom-game-rules'));
    fireEvent.click(screen.getByTestId('custom-game-options'));
    fireEvent.click(screen.getByTestId('custom-game-setup-open'));
    expect(opened.map((place) => place.screen)).toEqual([
      'options',
      'clock',
      'private-setup',
    ]);
  });

  test('exactly one command is filled: Start when ready, getting ready before that', () => {
    mountFrame(() => setupProps());
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'custom-game-start',
    ]);
    cleanup();
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          setup: hostSetup({
            start: {
              reason: { kind: 'unready', count: 1 },
              hostStarts: false,
              readiness: { ready: false, blocked: false },
              canStart: true,
            },
          }),
        }
      )
    );
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'custom-game-ready',
    ]);
    // Start is there, held back, and the line says why.
    expect(screen.getByTestId('custom-game-start')).toBeDisabled();
    expect(screen.getByTestId('custom-game-startable').textContent).toBe(
      'Waiting for 1 person to be ready.'
    );
  });

  test('an incomplete private setup is the next thing to do, in place of a readiness that cannot be given', () => {
    const opened: CustomGamePlace[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          onOpen: (place) => opened.push(place),
          setup: hostSetup({
            privateSetup: { complete: false, locked: false },
            start: {
              reason: { kind: 'unready', count: 1 },
              hostStarts: false,
              readiness: { ready: false, blocked: true },
              canStart: true,
            },
          }),
        }
      )
    );
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'custom-game-setup-arrange',
    ]);
    expect(shown('custom-game-ready')).toBe(false);
    fireEvent.click(screen.getByTestId('custom-game-setup-arrange'));
    expect(opened).toEqual([{ screen: 'private-setup' }]);
  });

  test('an invitation is answered where the invited person lands', () => {
    const chosen: unknown[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          viewerSide: null,
          play: FRAME_NO_PLAY,
          onChoose: async (input) => {
            chosen.push(input);
          },
          setup: hostSetup({
            seats: [
              setupSeat('white', { kind: 'person', person: 'a' }, 'avery', {
                host: true,
                ready: true,
              }),
              setupSeat(
                'black',
                { kind: 'invitation', person: 'j' },
                'Invited person: jordan',
                {
                  invitation: {
                    mine: true,
                    inviter: 'a',
                    inviterName: 'avery',
                    canAnswer: true,
                    canRevoke: false,
                  },
                }
              ),
            ],
            start: {
              reason: { kind: 'invitations', count: 1 },
              hostStarts: false,
              readiness: null,
              canStart: false,
            },
          }),
        }
      )
    );
    expect(
      screen.getByTestId('custom-game-black-invitation').textContent
    ).toContain('avery invites you to play Second side.');
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'custom-game-black-accept',
    ]);
    fireEvent.click(screen.getByTestId('custom-game-black-accept'));
    expect(chosen).toEqual([{ operation: 'accept', side: 'black' }]);
  });

  test('a place the game cannot show falls back to the lobby', () => {
    for (const place of [
      { screen: 'seat', side: 'blue' },
      { screen: 'invite', side: 'blue' },
      { screen: 'options' },
      { screen: 'clock' },
      { screen: 'private-setup' },
      { screen: 'play' },
    ] as const) {
      mountFrame(() => setupProps(place));
      expect(shown('custom-game-startable')).toBe(true);
      cleanup();
    }
  });
});

describe('a seat', () => {
  // regression: setup-change-player-vague
  // A seat's control said "Change player" and never said what it offered.
  // The seat's own place names every choice in words.
  test('names every choice the host has, the holder it has marked', () => {
    mountFrame(() => setupProps({ screen: 'seat', side: 'black' }));
    const text = (id: string) => screen.getByTestId(id).textContent ?? '';
    expect(text('custom-game-black-bot')).toContain('A bot');
    expect(text('custom-game-black-invite-choose')).toContain(
      'Someone in this space'
    );
    expect(text('custom-game-black-take')).toContain('Me');
    expect(text('custom-game-black-open')).toContain('Open seat');
    expect(text('custom-game-black-close')).toContain('Closed seat');
    expect(text('custom-game-black-local')).toContain(
      'A player on this device'
    );
    expect(
      screen.getByTestId('custom-game-black-bot').getAttribute('aria-current')
    ).toBe('true');
    expect(
      screen
        .getByTestId('custom-black-difficulty-medium')
        .getAttribute('aria-current')
    ).toBe('true');
  });

  test('a choice is sent, holds the other rows meanwhile, and returns to the lobby', async () => {
    let accept: () => void = () => undefined;
    const chosen: unknown[] = [];
    let closed = 0;
    mountFrame(() =>
      setupProps(
        { screen: 'seat', side: 'black' },
        {
          onChoose: (input) => {
            chosen.push(input);
            return new Promise<void>((resolve) => {
              accept = resolve;
            });
          },
          onClose: () => {
            closed += 1;
          },
        }
      )
    );
    fireEvent.click(screen.getByTestId('custom-game-black-open'));
    expect(chosen).toEqual([{ operation: 'open', side: 'black' }]);
    expect(screen.getByTestId('custom-game-black-bot')).toBeDisabled();
    // A second press while the first is on its way sends nothing.
    fireEvent.click(screen.getByTestId('custom-game-black-close'));
    expect(chosen).toHaveLength(1);
    expect(closed).toBe(0);
    accept();
    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(1);
  });

  test('a refused choice stays on the seat with every row to try again', async () => {
    let closed = 0;
    mountFrame(() =>
      setupProps(
        { screen: 'seat', side: 'black' },
        {
          error: 'Only the host may change who sits here.',
          onChoose: () => Promise.reject(new Error('refused')),
          onClose: () => {
            closed += 1;
          },
        }
      )
    );
    fireEvent.click(screen.getByTestId('custom-game-black-open'));
    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(0);
    expect(screen.getByTestId('custom-game-black-open')).not.toBeDisabled();
    expect(screen.getByTestId('custom-game-error').textContent).toContain(
      'Only the host may change who sits here.'
    );
  });

  test('inviting is its own place: a person is one press, someone seated cannot be pressed', () => {
    const chosen: unknown[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'invite', side: 'black' },
        {
          onChoose: async (input) => {
            chosen.push(input);
          },
        }
      )
    );
    expect(screen.getByTestId('custom-game-black-seated')).toBeDisabled();
    fireEvent.click(screen.getByTestId('custom-game-black-invitable'));
    expect(chosen).toEqual([
      { operation: 'invite', side: 'black', person: 'jordan-id' },
    ]);
  });
});

describe('the confirmation', () => {
  // regression: game-finish-unmounts-confirmation
  test.each(['resign', 'cancel'] as const)(
    '%s is confirmed over its place and survives the game finishing under it',
    async (operation) => {
      const [phase, setPhase] = createSignal<FramePhase>(
        operation === 'resign' ? 'active' : 'configuring'
      );
      let acknowledge: () => void = () => undefined;
      const acknowledgment = new Promise<void>((resolve) => {
        acknowledge = resolve;
      });
      // Confirming finishes the game, which replaces the place at once.
      const choose = async (): Promise<void> => {
        setPhase(operation === 'resign' ? 'completed' : 'cancelled');
        await acknowledgment;
      };
      const view = mountFrame(() =>
        operation === 'resign'
          ? frameProps({
              phase: phase(),
              place: { screen: 'commands' },
              onChoose: choose,
            })
          : setupProps(
              { screen: 'lobby' },
              { phase: phase(), onChoose: choose }
            )
      );
      fireEvent.click(view.getByTestId(`custom-game-${operation}`));
      expect(view.queryByRole('dialog')).not.toBeNull();
      fireEvent.click(view.getByTestId(`custom-game-${operation}-confirm`));
      // The place that asked is gone; the dialog is not.
      expect(view.queryByTestId(`custom-game-${operation}`)).toBeNull();
      expect(view.queryByRole('dialog')).not.toBeNull();
      acknowledge();
      const done = await view.findByTestId(`custom-game-${operation}-done`);
      expect(view.getByText('Game finished')).toBeInTheDocument();
      fireEvent.click(done);
      expect(view.queryByRole('dialog')).toBeNull();
      expect(view.getByTestId('custom-game-result-headline')).toBeTruthy();
    }
  );
});
