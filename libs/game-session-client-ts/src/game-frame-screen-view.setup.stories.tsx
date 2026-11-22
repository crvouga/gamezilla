import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_CONFIGURING as CONFIGURING,
  FRAME_GUEST,
  FRAME_WITH_OPTIONS,
  FrameSetupStory,
  HOST_CHOICES,
  HOST_CLOCK_ONLY,
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

/** A stand-in for a game's own setup board: a grid with pieces placed. */
function StorySetupBoard() {
  return (
    <CellGridBoard
      label="Your setup"
      testId="story-setup-board"
      columnLabels={'ABCDEF'.split('')}
      rowLabels={['1', '2', '3', '4']}
      cells={Array.from({ length: 24 }, (_, cell) => ({
        id: String(cell),
        label: cell < 3 ? `Piece ${cell + 1}` : `Empty ${cell + 1}`,
        glyph: cell < 3 ? '■' : '',
        tone: cell < 3 ? ('occupied' as const) : ('open' as const),
        enabled: false,
      }))}
    />
  );
}

const meta = {
  id: 'screens-games-custom-setup',
  title: 'Screens/Games/Custom game/Setup',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: { ...frameArgs(), ...CONFIGURING },
  render: (args) => <FrameSetupStory {...args} />,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before any game: the host plays the bots at once, or sets one up with people. */
export const Start: Story = {
  args: { ...frameArgs(), place: { screen: 'start' } },
};

/** Before any game, a guest waits for the host to create one. */
export const StartGuest: Story = {
  args: { ...frameArgs(), canCreate: false, place: { screen: 'start' } },
  render: (args) => <FrameSetupStory {...args} viewer="jordan" />,
};

/** The host set up a bot opponent and is ready: Start is the one command. */
export const HostReadyToStart: Story = {};

/**
 * The host is not ready and a seat is open: getting ready comes first, and
 * the note says what Start waits for.
 */
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
        options: HOST_CLOCK_ONLY,
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

/** The game's options, the player count and the clock are the settings rows. */
export const HostWithOptions: Story = { args: FRAME_WITH_OPTIONS };

/** An invitation is out: the seat says who was invited, and Start waits for the answer. */
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

/** The invited person is told where they land, and accepts or declines under it. */
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
            'jordan_plays'
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
        start: {
          reason: { kind: 'invitations', count: 1 },
          hostStarts: false,
          readiness: null,
          canStart: false,
        },
      }
    ),
  },
  render: (args) => <FrameSetupStory {...args} viewer="jordan" />,
};

/** A seated guest: getting ready is their one command, and the host starts. */
export const GuestSeated: Story = {
  args: FRAME_GUEST,
  render: (args) => <FrameSetupStory {...args} viewer="jordan" />,
};

/** A member with a seat open to them takes it, or stays to watch. */
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
  render: (args) => <FrameSetupStory {...args} viewer="morgan" />,
};

/** A timed game while set up: each seat's data line shows its clock. */
export const TimedSetup: Story = {
  args: {
    status: status({
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

/** A game with private setups: the viewer arranges theirs on the stage, then gets ready. */
export const PrivateSetup: Story = {
  args: {
    setupBoard: <StorySetupBoard />,
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

/** A player on this device and a closed seat, the other ways to fill a seat. */
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
        options: HOST_CLOCK_ONLY,
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

/** A refused choice is said under row 1, with everything still there to try again. */
export const ChoiceRefused: Story = {
  args: { error: 'That seat was just taken by someone else.' },
};

/** Pressing the bot's seat opens its actions: difficulty, a person, or no seat. */
export const OpenBotSeat: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByTestId('custom-game-black-choices'));
    await expect(
      await page.findByTestId('custom-game-black-difficulty')
    ).toBeVisible();
  },
};

/** Cancelling asks first, over the setup, with nothing chosen yet. */
export const ConfirmCancel: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByTestId('custom-game-cancel'));
    await page.findByText(/^The game ends for everyone/);
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};

/** A seat's sheet for the host: their own seat, readiness and leaving it. */
export const HostOwnSeat: Story = {
  args: {
    setup: setup(
      [HOST_SEAT, setupSeat(JORDAN, { ready: false, choices: HOST_CHOICES })],
      {
        start: {
          reason: { kind: 'unready', count: 1 },
          hostStarts: false,
          readiness: { ready: true, blocked: false },
          canStart: true,
        },
      }
    ),
  },
};
