import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_GUEST,
  FRAME_WITH_OPTIONS,
} from './game-frame-setup-story.example';
import {
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  RULE_OPTIONS,
  setup,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-options',
  title: 'Screens/Games/Custom game/Options',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...FRAME_WITH_OPTIONS,
    place: { screen: 'options' },
  },
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The game's own options, which the host changes; each change is sent as it is made. */
export const HostOptions: Story = {};

/** A guest reads the options the host chose, with no control to change them. */
export const GuestReadsOptions: Story = {
  args: {
    ...FRAME_GUEST,
    place: { screen: 'options' },
    setup: setup(FRAME_GUEST.setup?.seats ?? [], {
      options: {
        players: null,
        groups: RULE_OPTIONS,
        position: 'fixture',
        editable: false,
        clock: null,
      },
      start: FRAME_GUEST.setup?.start ?? {
        reason: null,
        hostStarts: true,
        readiness: null,
        canStart: false,
      },
    }),
  },
};

/** A refused option says why and shows the game's value again. */
export const OptionRefused: Story = {
  args: { error: 'Only the host may change the options.' },
};
