import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceEndedScreenView } from './space-ended-screen-view';
import { LONG_NAME } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-ended',
  title: 'Screens/Spaces/Space ended',
  component: SpaceEndedScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    title: 'Friday game night',
    hostName: 'avery',
    onBackToSpaces: fn(),
  },
} satisfies Meta<typeof SpaceEndedScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host ended the space: what it was, who hosted it, and the way back. */
export const Ended: Story = {};

/** The host's profile is not on this device: the title alone. */
export const UnknownHost: Story = {
  args: { title: "avery's space", hostName: '' },
};

/** Long titles and host names wrap in the body and truncate in the crumb. */
export const LongContent: Story = {
  args: {
    title:
      'The extremely long and very descriptive name of a space about board games',
    hostName: LONG_NAME.name,
  },
};

/** Back to Spaces leaves the ended space. */
export const BackToSpaces: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Back to Spaces' })
    );
    await expect(args.onBackToSpaces).toHaveBeenCalled();
  },
};
