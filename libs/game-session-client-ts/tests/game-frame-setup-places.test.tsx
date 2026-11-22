import { afterEach, describe, expect, test } from 'bun:test';
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
  spaceChrome,
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

/** Every choice sent, in order. */
function recorder() {
  const chosen: unknown[] = [];
  return {
    chosen,
    onChoose: async (input: unknown): Promise<void> => {
      chosen.push(input);
    },
  };
}

/** Opens the person sheet of a people-row cell. */
function press(testId: string): void {
  fireEvent.click(screen.getByTestId(testId));
}

describe('before a game', () => {
  test('the host plays the bots at once or sets a game up with people, in the setup template', () => {
    mountFrame(() =>
      frameProps({ phase: 'none', place: { screen: 'start' }, status: null })
    );
    expect(
      document.querySelector('[data-component="SpaceSetupTemplate"]')
    ).not.toBeNull();
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'custom-game-play-bot',
    ]);
    expect(shown('custom-game-create')).toBe(true);
    // Nothing to start yet, and no board.
    expect(shown('custom-game-start')).toBe(false);
    expect(
      document.querySelector('[data-component="GameBoardStage"]')
    ).toBeNull();
    // A listener still hears there is no game.
    expect(screen.getByTestId('custom-game-status').textContent).toContain(
      'No Custom Game.'
    );
  });

  test('someone who may not create a game is told who will', () => {
    mountFrame(
      () =>
        frameProps({
          phase: 'none',
          place: { screen: 'start' },
          canCreate: false,
        }),
      390,
      spaceChrome('jordan-id')
    );
    expect(shown('custom-game-create')).toBe(false);
    expect(
      screen.getByText('Waiting for the creator to create a game.')
    ).toBeTruthy();
  });
});

describe('the setup', () => {
  // regression: setup-preview-below-start
  // regression: phone-setup-preview-uninformative
  // regression: setup-preview-tiny
  // regression: setup-how-to-play-misaligned
  // regression: wide-setup-unbalanced
  // regression: setup-desktop-top-strip
  // The setup's board preview and its "How to play" card were rearranged
  // seven times. The setup holds no board at all: the people, the
  // settings and starting, in the space's three rows, on every size.
  test.each([390, 1440] as const)(
    'at %ipx the setup holds no board preview and no instructions card',
    (width) => {
      mountFrame(() => setupProps(), width);
      expect(
        document.querySelector('[data-component="GameBoardStage"]')
      ).toBeNull();
      expect(shown('custom-game-public')).toBe(false);
      expect(shown('custom-game-about')).toBe(false);
      expect(
        document.querySelector('[data-component="GameSection"]')
      ).toBeNull();
    }
  );

  // regression: setup-seats-nested-cards
  // regression: setup-player-controls-scattered
  // regression: setup-start-far-from-players
  test.each([390, 1440] as const)(
    'at %ipx the seats are cells of the people row, then the watchers, and Start under the stage',
    (width) => {
      mountFrame(() => setupProps(), width);
      const cells = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-component="SpacePersonCell"]'
        )
      );
      expect(cells.map((cell) => cell.dataset['testid'])).toEqual([
        'custom-game-white-choices',
        'custom-game-black-choices',
        undefined,
        undefined,
      ]);
      // A bot is always ready and never what the game waits for.
      expect(cells[0]?.dataset['status']).toBe('ready');
      expect(cells[1]?.dataset['status']).toBeUndefined();
      expect(cells[2]?.dataset['status']).toBe('watching');
      // No control scattered in the row: each cell opens its own sheet.
      const start = screen.getByTestId('custom-game-start');
      expect(
        (cells[1] as HTMLElement).compareDocumentPosition(start) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  );

  test('the setup says what is played, that it is unrated, and its clock', () => {
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        { goal: 'Count to ten before the other side does.' }
      )
    );
    const content = screen.getByTestId('custom-game-content');
    expect(content.dataset['place']).toBe('lobby');
    expect(content.dataset['phase']).toBe('configuring');
    expect(content.textContent).toContain('Counting race');
    expect(content.textContent).toContain(
      'Count to ten before the other side does.'
    );
    expect(content.textContent).toContain('Untimed');
    expect(screen.getByTestId('custom-game-unrated').textContent).toBe(
      'Unrated'
    );
  });

  test('the settings rows hold the player count, the options and the clock', () => {
    const sent = recorder();
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          onChoose: sent.onChoose,
          setup: hostSetup({
            options: {
              players: { count: 2, min: 2, max: 4 },
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
    // The count is read, never changed here: the seats set it.
    expect(shown('custom-game-players-increase')).toBe(false);
    expect(screen.getByText('Players')).toBeTruthy();
    fireEvent.click(screen.getByTestId('custom-game-option-rounds-increase'));
    fireEvent.click(screen.getByTestId('custom-game-untimed'));
    fireEvent.click(screen.getByTestId('custom-game-clock-10-0'));
    expect(sent.chosen).toEqual([
      { operation: 'rules', choice: 'rounds:4' },
      { operation: 'untimed' },
      { operation: 'clock', minutes: 10, increment: 0 },
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
            seats: hostSetup().seats.map((seat, index) =>
              index === 0 ? { ...seat, ready: false } : seat
            ),
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
    // No start that cannot be pressed sits beside it, and the line
    // speaks to the one person everyone waits for.
    expect(shown('custom-game-start')).toBe(false);
    expect(
      screen.getByText('Everyone else is in. Get ready to start.')
    ).toBeTruthy();
  });

  test('an incomplete private setup holds readiness back, with the setup board on the stage', () => {
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          setupBoard: <output data-testid="story-setup-board" />,
          setup: hostSetup({
            seats: hostSetup().seats.map((seat, index) =>
              index === 0 ? { ...seat, ready: false } : seat
            ),
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
    expect(screen.getByTestId('custom-game-ready')).toBeDisabled();
    expect(shown('story-setup-board')).toBe(true);
    expect(screen.getByTestId('custom-game-setup-status').textContent).toBe(
      'Your private setup is incomplete.'
    );
    expect(screen.getByTestId('custom-game-setup-random')).not.toBeDisabled();
  });

  test('an invitation is said where the invited person lands, and answered under it', () => {
    const sent = recorder();
    mountFrame(
      () =>
        setupProps(
          { screen: 'lobby' },
          {
            viewerSide: null,
            play: FRAME_NO_PLAY,
            onChoose: sent.onChoose,
            setup: hostSetup({
              seats: [
                setupSeat(
                  'white',
                  { kind: 'person', person: 'avery-id' },
                  'avery',
                  { host: true, ready: true }
                ),
                setupSeat(
                  'black',
                  { kind: 'invitation', person: 'jordan-id' },
                  'jordan',
                  {
                    invitation: {
                      mine: true,
                      inviter: 'avery-id',
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
        ),
      390,
      spaceChrome('jordan-id')
    );
    expect(
      screen.getByTestId('custom-game-black-invitation').textContent
    ).toContain('avery invites you to play Second side.');
    expect(filled().map((button) => button.dataset['testid'])).toEqual([
      'custom-game-black-accept',
    ]);
    fireEvent.click(screen.getByTestId('custom-game-black-accept'));
    expect(sent.chosen).toEqual([{ operation: 'accept', side: 'black' }]);
  });

  test('a place the game cannot show falls back to the setup', () => {
    mountFrame(() => setupProps({ screen: 'play' }));
    expect(screen.getByTestId('custom-game-content').dataset['phase']).toBe(
      'configuring'
    );
    expect(shown('custom-game-start')).toBe(true);
  });

  test('a refused choice is said under row 1, with everything still there', () => {
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        { error: 'Only the host may change who sits here.' }
      )
    );
    expect(screen.getByTestId('custom-game-error').textContent).toContain(
      'Only the host may change who sits here.'
    );
    expect(shown('custom-game-black-choices')).toBe(true);
  });
});

describe('a seat', () => {
  // regression: setup-change-player-vague
  // A seat's control said "Change player" and never said what it offered.
  // The seat's sheet names every choice in words.
  test("a bot's seat names every choice the host has", () => {
    mountFrame(() => setupProps());
    press('custom-game-black-choices');
    const text = (id: string) => screen.getByTestId(id).textContent ?? '';
    expect(text('custom-game-black-difficulty')).toContain('Change difficulty');
    expect(text('custom-game-black-take')).toContain('Play this side yourself');
    expect(text('custom-game-black-local')).toContain(
      'A player on this device'
    );
    expect(text('custom-game-black-open')).toContain('Remove bot');
    expect(text('custom-game-black-close')).toContain('Remove seat');
  });

  test("each of a seat's actions sends the room's choice for it", () => {
    const sent = recorder();
    mountFrame(() =>
      setupProps(
        { screen: 'lobby' },
        {
          onChoose: sent.onChoose,
          setup: hostSetup({
            seats: [
              hostSetup().seats[0] ??
                setupSeat('white', { kind: 'open' }, 'Open seat'),
              setupSeat('black', { kind: 'open' }, 'Open seat', {
                choices: HOST_CHOICES,
              }),
            ],
          }),
        }
      )
    );
    press('custom-game-black-choices');
    press('custom-game-black-bot');
    press('custom-game-black-choices');
    press('custom-game-black-close');
    press('custom-game-black-choices');
    press('custom-game-black-take');
    expect(sent.chosen).toEqual([
      { operation: 'bot', side: 'black' },
      { operation: 'close', side: 'black' },
      { operation: 'take', side: 'black' },
    ]);
  });

  test("a bot's difficulty steps to the next level", () => {
    const sent = recorder();
    mountFrame(() => setupProps({ screen: 'lobby' }, sent));
    press('custom-game-black-choices');
    press('custom-game-black-difficulty');
    expect(sent.chosen).toEqual([
      { operation: 'difficulty', side: 'black', difficulty: 'hard' },
    ]);
  });

  test("the host invites someone in the space from a seat's sheet", () => {
    const sent = recorder();
    mountFrame(() => setupProps({ screen: 'lobby' }, sent));
    press('custom-game-black-choices');
    const invite = screen.getByTestId('custom-game-black-invitable');
    expect(invite.textContent).toContain('Invite jordan');
    fireEvent.click(invite);
    expect(sent.chosen).toEqual([
      { operation: 'invite', side: 'black', person: 'jordan-id' },
    ]);
  });

  test('a member sits in an open seat from its sheet, or takes one under the setup', () => {
    const sent = recorder();
    mountFrame(
      () =>
        setupProps(
          { screen: 'lobby' },
          {
            viewerSide: null,
            play: FRAME_NO_PLAY,
            onChoose: sent.onChoose,
            setup: hostSetup({
              takeSeat: 'black',
              seats: [
                setupSeat(
                  'white',
                  { kind: 'person', person: 'avery-id' },
                  'avery',
                  { host: true, ready: true }
                ),
                setupSeat('black', { kind: 'open' }, 'Open seat', {
                  canSit: true,
                }),
              ],
              start: {
                reason: { kind: 'open-seats', count: 1 },
                hostStarts: false,
                readiness: null,
                canStart: false,
              },
            }),
          }
        ),
      390,
      spaceChrome('morgan-id')
    );
    press('custom-game-take-seat');
    press('custom-game-black-choices');
    press('custom-game-black-claim');
    expect(sent.chosen).toEqual([
      { operation: 'claim', side: 'black' },
      { operation: 'claim', side: 'black' },
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
