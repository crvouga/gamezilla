import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceUnreachableScreenView } from './space-unreachable-screen-view';

const meta = {
  id: 'screens-spaces-unreachable',
  title: 'Screens/Spaces/Space unreachable',
  component: SpaceUnreachableScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    title: 'Friday game night',
    onRetry: fn(),
    onBackToSpaces: fn(),
  },
} satisfies Meta<typeof SpaceUnreachableScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The space did not answer with a connection: Try again or go back. */
export const Unreachable: Story = {};

/** Long titles truncate in the breadcrumb. */
export const LongTitle: Story = {
  args: {
    title:
      'The extremely long and very descriptive name of a space about board games',
  },
};

/** Try again waits for the space afresh. */
export const TryAgain: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.spaceUnreachableRetry)
    );
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
