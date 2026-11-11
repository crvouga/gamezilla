import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { FrameStory } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_CONFIGURING as CONFIGURING,
  FRAME_GUEST,
  FRAME_WITH_OPTIONS,
  HOST_CHOICES,
  HOST_SEAT,
  INVITED_SEAT,
  OPEN_SEAT,
} from './game-frame-setup-story.example';
import {
  AVERY,
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  JORDAN,
  PEOPLE,
  person,
  seat,
  setup,
  setupSeat,
  status,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-lobby',
  title: 'Screens/Games/Custom game/Lobby',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: { ...frameArgs(), ...CONFIGURING },
  // The game's board heads the players as a small preview, never played on.
  render: (args) => (
    <FrameStory
      {...args}
      boardPreview={
        <ConnectFourStoryBoard moves={[]} testId="custom-game-board-preview" />
      }
    />
  ),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The host set up a bot opponent: every seat is filled and Start is the one
 * filled command, under a small preview of the game's board.
 */
export const HostReadyToStart: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const preview = await canvas.findByTestId('custom-game-preview');
    await expect(preview).toHaveAttribute('data-preview', 'true');
    await expect(
      within(preview).getByTestId('custom-game-board-preview')
    ).toBeVisible();
    await expect(canvas.queryByTestId('custom-game-board')).toBeNull();
  },
};

/** The game's options and the clock are agreed behind their own rows, each showing what is chosen. */
export const HostWithOptions: Story = { args: FRAME_WITH_OPTIONS };

/** An open seat: Start is held back and the start line says why; getting ready comes first. */
export const WaitingForPlayers: Story = {
  args: {
    status: status({
      lineup: 'Red circle: avery. Yellow diamond: Open place.',
      description: 'Waiting for participants and readiness.',
      emphasis: 'neutral',
    }),
    setup: setup(
      [
        { ...HOST_SEAT, ready: false },
        setupSeat(OPEN_SEAT, { choices: HOST_CHOICES }),
      ],
      {
        start: {
          reason: { kind: 'open-seats', count: 1 },
          hostStarts: false,
          readiness: { ready: false, blocked: false },
          canStart: true,
        },
      }
    ),
  },
};

/** An invitation is out: its seat says who was invited, and Start waits for the answer. */
export const InvitationPending: Story = {
  args: {
    setup: setup([HOST_SEAT, INVITED_SEAT], {
      start: {
        reason: { kind: 'invitations', count: 1 },
        hostStarts: false,
        readiness: { ready: true, blocked: false },
        canStart: true,
      },
    }),
  },
};

/** The invited person answers where they land: accept to take the seat, or decline. */
export const InvitedToPlay: Story = {
  args: {
    viewerSide: null,
    play: FRAME_NO_PLAY,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true }),
        setupSeat(
          seat(
            'black',
            { kind: 'invitation', person: PEOPLE.jordan },
            'Invited person: jordan_plays'
          ),
          {
            invitation: {
              mine: true,
              inviter: PEOPLE.avery,
              inviterName: 'avery',
              canAnswer: true,
              canRevoke: false,
            },
          }
        ),
      ],
      {
        viewerNotice: "You're watching this game.",
        start: {
          reason: { kind: 'invitations', count: 1 },
          hostStarts: false,
          readiness: null,
          canStart: false,
        },
      }
    ),
  },
};

/** A seated guest: their own seat is marked, getting ready is their one command, and the host starts. */
export const GuestSeated: Story = { args: FRAME_GUEST };

/** A seated guest who is ready waits for the host, and may take readiness back. */
export const GuestReady: Story = {
  args: {
    ...FRAME_GUEST,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true }),
        setupSeat(JORDAN, {
          visiting: true,
          own: true,
          ready: true,
          canLeave: true,
        }),
      ],
      {
        start: {
          reason: null,
          hostStarts: true,
          readiness: { ready: true, blocked: false },
          canStart: false,
        },
      }
    ),
  },
};

/** A member with a seat open to them: Take a seat is the one filled command, or they stay to watch. */
export const MemberMayTakeSeat: Story = {
  args: {
    viewerSide: null,
    play: FRAME_NO_PLAY,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true }),
        setupSeat(OPEN_SEAT, { canSit: true }),
      ],
      {
        viewerNotice: 'Sit in an open seat to play, or stay to watch.',
        takeSeat: 'black',
        start: {
          reason: { kind: 'open-seats', count: 1 },
          hostStarts: false,
          readiness: null,
          canStart: false,
        },
      }
    ),
  },
};

/** Every seat is taken: the person is told they will watch, and no row opens. */
export const AllSeatsTaken: Story = {
  args: {
    viewerSide: null,
    play: FRAME_NO_PLAY,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true }),
        setupSeat(JORDAN, { ready: true }),
      ],
      {
        viewerNotice: "All seats are taken. You'll watch.",
        start: {
          reason: null,
          hostStarts: false,
          readiness: null,
          canStart: false,
        },
      }
    ),
  },
};

/** A timed game while set up: each seat shows its full clock. */
export const TimedSetup: Story = {
  args: {
    status: status({
      lineup: 'Red circle: avery. Yellow diamond: jordan_plays.',
      description: 'Ready to start.',
      emphasis: 'neutral',
      tone: 'success',
      minutes: 10,
      increment: 5,
    }),
    setup: setup(
      [
        setupSeat(
          seat('white', person('avery'), 'avery', {
            value: '10:00',
            active: false,
          }),
          { host: true, own: true, ready: true, choices: HOST_CHOICES }
        ),
        setupSeat(
          seat('black', person('jordan'), 'jordan_plays', {
            value: '10:00',
            active: false,
          }),
          { ready: true, choices: HOST_CHOICES }
        ),
      ],
      {
        options: {
          players: null,
          groups: [],
          position: 'fixture',
          editable: true,
          clock: { minutes: 10, increment: 5 },
        },
      }
    ),
  },
};

/** A game with private setups: the row says theirs is incomplete, and getting ready is held back. */
export const PrivateSetupIncomplete: Story = {
  args: {
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      privateSetup: { complete: false, locked: false },
      start: {
        reason: { kind: 'unready', count: 1 },
        hostStarts: false,
        readiness: { ready: false, blocked: true },
        canStart: true,
      },
    }),
  },
};

/** A guest on this device and a closed seat, the other ways to fill a place. */
export const LocalAndClosedSeats: Story = {
  args: {
    playerCount: 3,
    setup: setup(
      [
        HOST_SEAT,
        setupSeat(seat('black', { kind: 'local' }, 'Player on this device'), {
          ready: true,
          choices: HOST_CHOICES,
        }),
        setupSeat(seat('red', { kind: 'closed' }, 'Closed place'), {
          choices: HOST_CHOICES,
        }),
      ],
      {
        start: {
          reason: { kind: 'incomplete', count: 1 },
          hostStarts: false,
          readiness: { ready: true, blocked: false },
          canStart: true,
        },
      }
    ),
  },
};

/** Offline while setting up: the notice says changes need the connection. */
export const ConnectionNeeded: Story = { args: { connection: 'needed' } };

/** A refused choice is said at the top of the lobby, with every row still there to try again. */
export const ChoiceRefused: Story = {
  args: { error: 'That seat was just taken by someone else.' },
};

/** Long names wrap inside their rows and never push the clock or the chevron away. */
export const LongContent: Story = {
  args: {
    title: 'Connect Four: the extended tournament edition',
    setup: setup([
      setupSeat(
        seat(
          'white',
          person('avery'),
          'avery_the_extraordinarily_patient_strategist'
        ),
        { host: true, own: true, ready: true, choices: HOST_CHOICES }
      ),
      setupSeat(
        seat(
          'black',
          person('jordan'),
          'jordan_plays_every_single_evening_online'
        ),
        { ready: false, choices: HOST_CHOICES }
      ),
    ]),
  },
};

/** A seat's row opens that seat's own place, and Back returns to the lobby. */
export const OpenSeat: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-black-choices')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({
      screen: 'seat',
      side: 'black',
    });
    await expect(
      await canvas.findByTestId('custom-black-difficulty-hard')
    ).toBeVisible();
  },
};

/** Cancelling asks first, over the lobby, with nothing chosen yet. */
export const ConfirmCancel: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByTestId('custom-game-cancel'));
    await canvas.findByText(/^This finishes the current game\./);
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};
