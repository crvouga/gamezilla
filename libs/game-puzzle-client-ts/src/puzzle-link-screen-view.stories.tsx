import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleLinkScreenView } from './puzzle-link-screen-view';

const meta = {
  id: 'screens-puzzles-link',
  title: 'Screens/Puzzles/Puzzle link',
  component: PuzzleLinkScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['denial'] } },
  args: { status: 'opening', onRetry: fn(), onGoHome: fn() },
} satisfies Meta<typeof PuzzleLinkScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The puzzle is being placed on the person's board in their space. */
export const Opening: Story = {};

/** Puzzles need a connection; the link can be opened again once back online. */
export const Offline: Story = { args: { status: 'offline' } };

/** The puzzle was taken out, so its link no longer opens it; home is offered. */
export const Unavailable: Story = { args: { status: 'unavailable' } };

/** The person cannot open another space for the puzzle; the denial says why. */
export const Denied: Story = {
  args: {
    status: 'denied',
    denial: {
      icon: ClockIcon,
      title: "You've reached your space limit",
      body: 'Leave or end a space to open this puzzle in a new one.',
      action: { label: 'See plans', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'quota_exhausted' },
    },
  },
};

/** Offline, "Try again" opens the link again. */
export const RetryOffline: Story = {
  args: { status: 'offline' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Try again' })
    );
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
