import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_CONFIGURING as CONFIGURING,
  FRAME_GUEST,
  HOST_CHOICES,
  HOST_SEAT,
  INVITED_SEAT,
  OPEN_SEAT,
} from './game-frame-setup-story.example';
import {
  AVERY,
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  PEOPLE,
  seat,
  setup,
  setupSeat,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-seat',
  title: 'Screens/Games/Custom game/Seat',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...CONFIGURING,
    place: { screen: 'seat', side: 'black' },
  },
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A seat a bot holds, as the host changes it: who sits here, the bot marked, then its level. */
export const BotSeat: Story = {};

/** The host's own seat: leaving it, or putting someone else in it. */
export const HostOwnSeat: Story = {
  args: { place: { screen: 'seat', side: 'white' } },
};

/** An open seat, as the host fills it: open is the choice it holds now. */
export const OpenSeat: Story = {
  args: {
    setup: setup([HOST_SEAT, setupSeat(OPEN_SEAT, { choices: HOST_CHOICES })]),
  },
};

/** An invitation is out on this seat: the host may revoke it, or choose someone else. */
export const InvitationOut: Story = {
  args: { setup: setup([HOST_SEAT, INVITED_SEAT]) },
};

/** A guest's own seat: the one thing they may do with it is leave. */
export const GuestOwnSeat: Story = { args: FRAME_GUEST };

/** A member at an open seat: sitting is their one choice. */
export const MemberSits: Story = {
  args: {
    viewerSide: null,
    play: FRAME_NO_PLAY,
    setup: setup([
      setupSeat(AVERY, { host: true, ready: true }),
      setupSeat(OPEN_SEAT, { canSit: true }),
    ]),
  },
};

/** A game with no bots and no guests on one device: only people, open or closed. */
export const PeopleOnly: Story = {
  args: {
    setup: setup([
      HOST_SEAT,
      setupSeat(OPEN_SEAT, {
        choices: { ...HOST_CHOICES, bots: false, localPlayers: false },
      }),
    ]),
  },
};

/** A refused choice stays on the seat, with every choice still there. */
export const ChoiceRefused: Story = {
  args: { error: 'Only the host may change who sits here.' },
};

/** Choosing a bot sends the choice and returns to the lobby. */
export const ChooseBot: Story = {
  args: {
    setup: setup([HOST_SEAT, setupSeat(OPEN_SEAT, { choices: HOST_CHOICES })]),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-black-bot'));
    await expect(args.onChoose).toHaveBeenCalledWith({
      operation: 'bot',
      side: 'black',
    });
    await expect(
      await canvas.findByTestId('custom-game-startable')
    ).toBeVisible();
  },
};

/** Inviting is its own place behind the seat: a list of the space's people. */
export const OpenInvite: Story = {
  args: {
    setup: setup([HOST_SEAT, setupSeat(OPEN_SEAT, { choices: HOST_CHOICES })]),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-black-invite-choose')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({
      screen: 'invite',
      side: 'black',
    });
  },
};

/** A seat that is gone (the table shrank) falls back to the lobby instead of an empty place. */
export const SeatGone: Story = {
  args: {
    place: { screen: 'seat', side: 'blue' },
    setup: setup([
      HOST_SEAT,
      setupSeat(
        seat('black', { kind: 'invitation', person: PEOPLE.jordan }, 'jordan'),
        {}
      ),
    ]),
  },
};
