import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceHomeScreenView } from './space-home-screen-view';
import {
  STORY_SPACE_CHROME,
  StorySpaceFrame,
} from './space-screen-chrome-story.example';
import { GAMES } from './spaces-story.example';

const meta = {
  id: 'screens-space-home',
  title: 'Screens/Space/Space home/Home',
  component: SpaceHomeScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['games'] } },
  args: { games: GAMES, canSelectGame: true, onSelectGame: fn() },
  // The screen reads its space from the chrome the app mounts around it, and
  // claims that frame's shell: rendered inside the frame, as the app does. A
  // decorator's story is not below the frame, so both would draw a top bar.
  // The story shell therefore leaves this frame to the story
  // (`SELF_FRAMED_SPACE_BODIES` in the product's `storybook-route`).
  render: (args) => (
    <StorySpaceFrame guest={!args.canSelectGame}>
      <SpaceHomeScreenView {...args} />
    </StorySpaceFrame>
  ),
} satisfies Meta<typeof SpaceHomeScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The host's space before a game is picked, as the product wires it: the
 * catalogue's `Templates/Space/SpaceLauncher` (the stage template with the launcher) over
 * the space's own chrome and the registered games.
 */
export const HostChoosing: Story = {};

export const LongName: Story = {
  render: (args) => (
    <StorySpaceFrame spaceName="Friday game night with the whole family and friends from out of town">
      <SpaceHomeScreenView {...args} />
    </StorySpaceFrame>
  ),
};

/** Someone who cannot pick sees the same games and that the host is choosing. */
export const GuestWaiting: Story = { args: { canSelectGame: false } };

/** Pressing a game as host selects it for the whole space. */
export const SelectGame: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-menu-example-cards'));
    await expect(args.onSelectGame).toHaveBeenCalledWith('example-cards');
  },
};

/** J6: who is here is the top bar's first button, at every width. */
export const OpenPeople: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.spaceMembersButton)
    );
    await expect(STORY_SPACE_CHROME.onMembers).toHaveBeenCalled();
  },
};

/** The host opens the space settings from the bar. */
export const OpenSettings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceSettings));
    await expect(STORY_SPACE_CHROME.onSettings).toHaveBeenCalled();
  },
};
