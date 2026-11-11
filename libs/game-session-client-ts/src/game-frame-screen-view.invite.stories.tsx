import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_CONFIGURING as CONFIGURING,
  HOST_CHOICES,
  HOST_SEAT,
  OPEN_SEAT,
} from './game-frame-setup-story.example';
import {
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  PEOPLE,
  setup,
  setupSeat,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-invite',
  title: 'Screens/Games/Custom game/Invite',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...CONFIGURING,
    place: { screen: 'invite', side: 'black' },
    setup: setup([HOST_SEAT, setupSeat(OPEN_SEAT, { choices: HOST_CHOICES })]),
  },
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The space's people: someone already seated cannot be invited, and says why. */
export const People: Story = {};

/** Nobody else is in the space: the place says so and what to do instead. */
export const NobodyElse: Story = {
  args: {
    setup: setup([
      HOST_SEAT,
      setupSeat(OPEN_SEAT, { choices: { ...HOST_CHOICES, invitees: [] } }),
    ]),
  },
};

/** A long list of members stays one list of rows. */
export const ManyPeople: Story = {
  args: {
    setup: setup([
      HOST_SEAT,
      setupSeat(OPEN_SEAT, {
        choices: {
          ...HOST_CHOICES,
          invitees: [
            { person: PEOPLE.avery, plainName: 'avery', disabled: true },
            {
              person: PEOPLE.jordan,
              plainName: 'jordan_plays',
              disabled: false,
            },
            { person: PEOPLE.morgan, plainName: 'morgan', disabled: false },
            { person: PEOPLE.robin, plainName: 'robin', disabled: false },
            ...Array.from({ length: 8 }, (_, index) => ({
              person: `0b6a1c52-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
              plainName: `member_${String(index + 1)}`,
              disabled: false,
            })),
          ],
        },
      }),
    ]),
  },
};

/** Pressing a person invites them and returns to the lobby. */
export const InvitePerson: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = await canvas.findAllByTestId('custom-game-black-invitable');
    if (first === undefined) throw new Error('nobody to invite');
    await userEvent.click(first);
    await expect(args.onChoose).toHaveBeenCalledWith({
      operation: 'invite',
      side: 'black',
      person: PEOPLE.jordan,
    });
    await expect(
      await canvas.findByTestId('custom-game-startable')
    ).toBeVisible();
  },
};
