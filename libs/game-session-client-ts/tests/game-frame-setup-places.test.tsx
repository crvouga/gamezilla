import { afterEach, describe, expect, test } from 'bun:test';
import { FRAME_NO_PLAY } from '@libs/game-session-client-ts/game-frame-empty';
import type { FramePhase } from '@libs/game-session-client-ts/game-frame-view-types';
import type { GameSessionPlace } from '@libs/game-session-client-ts/game-session-places';
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

describe('the lobby', () => {
  // regression: setup-preview-below-start
  // regression: phone-setup-preview-uninformative
  // regression: setup-preview-tiny
  // regression: setup-how-to-play-misaligned
  // regression: wide-setup-unbalanced
  // regression: setup-desktop-top-strip
  // The setup's board preview and its "How to play" card were rearranged
  // seven times. The lobby holds no board at all: the people, what is
  // agreed and starting, in one column, on every size.
  test.each([390, 1440] as const)(
    'at %ipx the lobby holds no board preview and no instructions card',
    (width) => {
      mountFrame(() => setupProps(), width);
      expect(
        document.querySelector('[data-component="GameBoardStage"]')
      ).toBeNull();
      expect(shown('game-session-public')).toBe(false);
      expect(shown('game-session-about')).toBe(false);
      expect(
        document.querySelector('[data-component="GameSection"]')
      ).toBeNull();
    }
  );

  // regression: setup-seats-nested-cards
  // regression: setup-player-controls-scattered
  // regression: setup-start-far-from-players
  test.each([390, 1440] as const)(
    'at %ipx the seats are one list of rows, Start after them in the same column',
    (width) => {
      mountFrame(() => setupProps(), width);
      const seats = screen.getByTestId('game-session-setup-seats');
      const rows = seats.querySelectorAll('[data-component="MenuRow"]');
      expect(rows).toHaveLength(2);
      // One list: no card inside the card, and no control scattered in a row.
      expect(seats.querySelector('[data-component="GameSection"]')).toBeNull();
      expect(seats.querySelector('[data-component="Button"]')).toBeNull();
      const start = screen.getByTestId('game-session-start');
      expect(
        seats.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      // A bot is always ready and never what the game waits for.
      expect(rows[1]?.textContent).not.toContain('Ready');
      expect(rows[0]?.textContent).toContain('Ready');
    }
  );

  test('a seat the viewer may change opens its own place; one they may not only reads', () => {
    const opened: GameSessionPlace[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'setup' },
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
    expect(shown('game-session-white-choices')).toBe(false);
    expect(screen.getByTestId('game-session-white').tagName).not.toBe('BUTTON');
    fireEvent.click(screen.getByTestId('game-session-black-choices'));
    expect(opened).toEqual([{ screen: 'seat', side: 'black' }]);
  });

  test('the lobby opens with what is played and keeps its one command in a dock', () => {
    mountFrame(() =>
      setupProps(
        { screen: 'setup' },
        { goal: 'Count to ten before the other side does.' }
      )
    );
    const mode = screen.getByTestId('game-session-mode');
    expect(mode.querySelector('h1')?.textContent).toBe('Counting race');
    expect(mode.textContent).toContain(
      'Count to ten before the other side does.'
    );
    expect(mode.textContent).toContain('Untimed');
    expect(screen.getByTestId('game-session-unrated').textContent).toBe(
      'Unrated'
    );
    const dock = document.querySelector('[data-component="GameLobbyDock"]');
    expect(dock?.contains(screen.getByTestId('game-session-startable'))).toBe(
      true
    );
    expect(dock?.contains(screen.getByTestId('game-session-start'))).toBe(true);
    // The dock is outside what scrolls.
    const scroller = document.querySelector('[data-component="ScrollView"]');
    expect(scroller?.contains(dock as Element)).toBe(false);
    expect(scroller?.contains(mode)).toBe(true);
  });

  test('what is agreed sits behind its own row, each saying what is chosen', () => {
    const opened: GameSessionPlace[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'setup' },
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
    expect(screen.getByTestId('game-session-rules').textContent).toContain('3');
    // In plain words, for someone who does not read `5+3`.
    expect(screen.getByTestId('game-session-options').textContent).toContain(
      '5 min + 3 sec'
    );
    // The row shows one word; a listener hears the whole sentence.
    expect(screen.getByTestId('game-session-setup-status').textContent).toBe(
      'Your private setup is incomplete.'
    );
    // Nothing is changed on the lobby itself.
    expect(shown('game-session-minutes')).toBe(false);
    expect(shown('game-session-setup-random')).toBe(false);
    fireEvent.click(screen.getByTestId('game-session-rules'));
    fireEvent.click(screen.getByTestId('game-session-options'));
    fireEvent.click(screen.getByTestId('game-session-setup-open'));
    expect(opened.map((place) => place.screen)).toEqual([
      'options',
      'clock',
      'private-setup',
    ]);
  });

  test('a time edited on the clock is kept on the way back to setup', async () => {
    const chosen: unknown[] = [];
    let closed = 0;
    mountFrame(() =>
      setupProps(
        { screen: 'clock' },
        {
          onChoose: async (input) => {
            chosen.push(input);
          },
          onClose: () => {
            closed += 1;
          },
          setup: hostSetup({
            options: {
              players: null,
              groups: [],
              position: 'fixture',
              editable: true,
              clock: { minutes: 5, increment: 3 },
            },
          }),
        }
      )
    );
    const minutes = screen
      .getByTestId('game-session-minutes')
      .querySelector('input') as HTMLInputElement;
    fireEvent.input(minutes, { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('game-session-place-back'));
    await Promise.resolve();
    await Promise.resolve();
    expect(chosen).toEqual([{ operation: 'clock', minutes: 10, increment: 3 }]);
    expect(closed).toBe(1);
  });

  test('exactly one command is filled: Start when ready, getting ready before that', () => {
    mountFrame(() => setupProps());
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'game-session-start',
    ]);
    cleanup();
    mountFrame(() =>
      setupProps(
        { screen: 'setup' },
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
      'game-session-ready',
    ]);
    // No start that cannot be pressed sits beside it, and the line
    // speaks to the one person everyone waits for.
    expect(screen.queryByTestId('game-session-start')).toBeNull();
    expect(screen.getByTestId('game-session-startable').textContent).toBe(
      'Everyone else is in. Get ready to start.'
    );
  });

  test('an incomplete private setup is the next thing to do, in place of a readiness that cannot be given', () => {
    const opened: GameSessionPlace[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'setup' },
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
      'game-session-setup-arrange',
    ]);
    expect(shown('game-session-ready')).toBe(false);
    fireEvent.click(screen.getByTestId('game-session-setup-arrange'));
    expect(opened).toEqual([{ screen: 'private-setup' }]);
  });

  test('an invitation is answered where the invited person lands', () => {
    const chosen: unknown[] = [];
    mountFrame(() =>
      setupProps(
        { screen: 'setup' },
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
      screen.getByTestId('game-session-black-invitation').textContent
    ).toContain('avery invites you to play Second side.');
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'game-session-black-accept',
    ]);
    fireEvent.click(screen.getByTestId('game-session-black-accept'));
    expect(chosen).toEqual([{ operation: 'accept', side: 'black' }]);
  });

  test('a place the game cannot show falls back to the lobby', () => {
    for (const place of [
      { screen: 'seat', side: 'blue' },
      { screen: 'invite', side: 'blue' },
      { screen: 'options' },
      { screen: 'clock' },
      { screen: 'private-setup' },
      { screen: 'stage' },
    ] as const) {
      mountFrame(() => setupProps(place));
      expect(shown('game-session-startable')).toBe(true);
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
    expect(screen.queryByTestId('game-session-black-bot')).toBeNull();
    expect(screen.queryByTestId('custom-black-difficulty-medium')).toBeNull();
    expect(screen.getByTestId('game-session-black-local')).toBeTruthy();
    expect(text('game-session-black-invite-choose')).toContain(
      'Someone in this space'
    );
    expect(text('game-session-black-take')).toContain('Me');
    expect(text('game-session-black-open')).toContain('Open seat');
    expect(text('game-session-black-close')).toContain('Closed seat');
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
    fireEvent.click(screen.getByTestId('game-session-black-open'));
    expect(chosen).toEqual([{ operation: 'open', side: 'black' }]);
    expect(screen.getByTestId('game-session-black-take')).toBeDisabled();
    // A second press while the first is on its way sends nothing.
    fireEvent.click(screen.getByTestId('game-session-black-close'));
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
    fireEvent.click(screen.getByTestId('game-session-black-open'));
    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(0);
    expect(screen.getByTestId('game-session-black-open')).not.toBeDisabled();
    expect(screen.getByTestId('game-session-error').textContent).toContain(
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
    expect(screen.getByTestId('game-session-black-seated')).toBeDisabled();
    fireEvent.click(screen.getByTestId('game-session-black-invitable'));
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
              { screen: 'setup' },
              { phase: phase(), onChoose: choose }
            )
      );
      fireEvent.click(view.getByTestId(`game-session-${operation}`));
      // The confirmation opens (over the game's menu sheet, for resign).
      expect(
        view.getByTestId(`game-session-${operation}-confirm`)
      ).toBeInTheDocument();
      fireEvent.click(view.getByTestId(`game-session-${operation}-confirm`));
      // The place that asked is gone; the confirm is not.
      expect(view.queryByTestId(`game-session-${operation}`)).toBeNull();
      expect(view.queryAllByRole('dialog').length).toBeGreaterThan(0);
      acknowledge();
      const done = await view.findByTestId(`game-session-${operation}-done`);
      expect(view.getByText('Game finished')).toBeInTheDocument();
      fireEvent.click(done);
      expect(view.queryByTestId(`game-session-${operation}-done`)).toBeNull();
      // The ended game's outcome is its own dialog over the final board.
      const outcome = view.getByRole('dialog', { name: 'Game over' });
      expect(
        outcome.contains(view.getByTestId('game-session-result-headline'))
      ).toBe(true);
    }
  );
});
