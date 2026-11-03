import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from './game-frame-screen-view';
import {
  AVERY,
  BOT,
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  JORDAN,
  PEOPLE,
  person,
  RULE_OPTIONS,
  record,
  seat,
  setup,
  setupSeat,
  status,
} from './game-frame-story.example';
import type { FrameSeatChoices } from './game-frame-view-types';

const HOST_CHOICES: FrameSeatChoices = {
  localPlayers: true,
  bots: true,
  difficulties: [],
  difficulty: undefined,
  invitees: [
    { person: PEOPLE.avery, plainName: 'avery', disabled: true },
    { person: PEOPLE.jordan, plainName: 'jordan_plays', disabled: false },
    { person: PEOPLE.morgan, plainName: 'morgan', disabled: false },
  ],
};

const OPEN = seat('black', { kind: 'open' }, 'Open place');

const CONFIGURING: Partial<GameFrameScreenViewProps> = {
  phase: 'configuring',
  status: status({
    lineup: 'Red circle: avery. Yellow diamond: Bot (medium).',
    description: 'Ready to start.',
    emphasis: 'neutral',
    tone: 'success',
  }),
  setup: setup([
    setupSeat(AVERY, {
      host: true,
      ready: true,
      canLeave: true,
      choices: HOST_CHOICES,
    }),
    setupSeat(BOT, {
      choices: {
        ...HOST_CHOICES,
        difficulties: ['easy', 'medium', 'hard'],
        difficulty: 'medium',
      },
    }),
  ]),
  record: record([]),
};

const meta = {
  id: 'screens-games-custom-setup',
  title: 'Screens/Games/Custom game/Setup',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: frameArgs(),
  render: (args) => (
    <GameFrameScreenView
      {...args}
      board={<ConnectFourStoryBoard moves={[]} />}
    />
  ),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No game yet: a host may create one or play a bot at once. */
export const NoGame: Story = {};

/** No game yet, for a bigger game: the quick start plays against bots. */
export const NoGameManyPlayers: Story = { args: { playerCount: 4 } };

/** No game yet, and the person may not create one: they wait for the creator. */
export const WaitingForCreator: Story = { args: { canCreate: false } };

/** The host set up a bot opponent: every seat is filled and the game can start. */
export const HostReadyToStart: Story = { args: CONFIGURING };

/** The host's seat choices open: who sits here, bot level, and invitations. */
export const HostSeatChoices: Story = {
  args: CONFIGURING,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-black-choices')
    );
    await expect(
      await canvas.findByTestId('custom-black-difficulty-hard')
    ).toBeVisible();
  },
};

/** An open seat: Start is held back and the start line says why. */
export const WaitingForPlayers: Story = {
  args: {
    ...CONFIGURING,
    status: status({
      lineup: 'Red circle: avery. Yellow diamond: Open place.',
      description: 'Waiting for participants and readiness.',
      emphasis: 'neutral',
    }),
    setup: setup(
      [
        setupSeat(AVERY, { host: true, canLeave: true, choices: HOST_CHOICES }),
        setupSeat(OPEN, { choices: HOST_CHOICES }),
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

/** An invitation is out: the host may revoke it while it waits for an answer. */
export const InvitationPending: Story = {
  args: {
    ...CONFIGURING,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true, choices: HOST_CHOICES }),
        setupSeat(
          seat(
            'black',
            { kind: 'invitation', person: PEOPLE.jordan },
            'Invited person: jordan_plays'
          ),
          {
            invitation: {
              mine: false,
              inviter: PEOPLE.avery,
              inviterName: 'avery',
              canAnswer: false,
              canRevoke: true,
            },
            choices: HOST_CHOICES,
          }
        ),
      ],
      {
        start: {
          reason: { kind: 'invitations', count: 1 },
          hostStarts: false,
          readiness: { ready: true, blocked: false },
          canStart: true,
        },
      }
    ),
  },
};

/** The invited person answers: accept to take the seat, or decline. */
export const InvitedToPlay: Story = {
  args: {
    ...CONFIGURING,
    viewerSide: null,
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

/** A seated guest: their own seat is marked and the host starts the game. */
export const GuestSeated: Story = {
  args: {
    ...CONFIGURING,
    viewerSide: 'black',
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true }),
        setupSeat(JORDAN, { visiting: true, canLeave: true }),
      ],
      {
        start: {
          reason: { kind: 'unready', count: 1 },
          hostStarts: true,
          readiness: { ready: false, blocked: false },
          canStart: false,
        },
      }
    ),
  },
};

/** A member with a seat open to them: sit down to play, or stay to watch. */
export const MemberMayTakeSeat: Story = {
  args: {
    ...CONFIGURING,
    viewerSide: null,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true }),
        setupSeat(OPEN, { canSit: true }),
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

/** Every seat is taken: the person is told they will watch. */
export const AllSeatsTaken: Story = {
  args: {
    ...CONFIGURING,
    viewerSide: null,
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

/** The game's own options and the clock, which the host changes before the start. */
export const HostOptions: Story = {
  args: {
    ...CONFIGURING,
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      options: {
        players: { count: 2, min: 2, max: 4 },
        groups: RULE_OPTIONS,
        position: 'fixture',
        editable: true,
        clock: { minutes: 5, increment: 3 },
      },
    }),
  },
};

/** A guest reads the options the host chose, with no control to change them. */
export const GuestReadsOptions: Story = {
  args: {
    ...CONFIGURING,
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      options: {
        players: null,
        groups: RULE_OPTIONS,
        position: 'fixture',
        editable: false,
        clock: null,
      },
      start: {
        reason: null,
        hostStarts: true,
        readiness: { ready: true, blocked: false },
        canStart: false,
      },
    }),
  },
};

/** A timed game while set up: each seat shows its full clock. */
export const TimedSetup: Story = {
  args: {
    ...CONFIGURING,
    status: status({ ...CONFIGURING.status, minutes: 10, increment: 5 }),
    setup: setup([
      setupSeat(
        seat('white', person('avery'), 'avery', {
          value: '10:00',
          active: false,
        }),
        {
          host: true,
          ready: true,
        }
      ),
      setupSeat(
        seat('black', person('jordan'), 'jordan_plays', {
          value: '10:00',
          active: false,
        }),
        {
          ready: true,
        }
      ),
    ]),
  },
};

/** A game with private setups: the viewer arranges theirs before getting ready. */
export const PrivateSetupIncomplete: Story = {
  args: {
    ...CONFIGURING,
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

/** The private setup is complete and the viewer is ready: it locks. */
export const PrivateSetupReady: Story = {
  args: {
    ...CONFIGURING,
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      privateSetup: { complete: true, locked: true },
    }),
  },
};

/** A guest on this device and a closed seat, the other ways to fill a place. */
export const LocalAndClosedSeats: Story = {
  args: {
    ...CONFIGURING,
    playerCount: 3,
    setup: setup(
      [
        setupSeat(AVERY, { host: true, ready: true, choices: HOST_CHOICES }),
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
