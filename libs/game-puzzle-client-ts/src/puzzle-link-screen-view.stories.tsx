import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleLinkScreenView } from './puzzle-link-screen-view';

const meta = {
  id: 'screens-puzzles-link',
  title: 'Screens/Puzzles/Puzzle link',
  component: PuzzleLinkScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['denial'] } },
  args: { status: 'opening' },
} satisfies Meta<typeof PuzzleLinkScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The puzzle is being placed on the person's board in their space. */
export const Opening: Story = {};

/** Puzzles need a connection; the link opens again once reconnected. */
export const Offline: Story = { args: { status: 'offline' } };

/** The puzzle was taken out, so its link no longer opens it. */
export const Unavailable: Story = { args: { status: 'unavailable' } };

/** The person cannot open another space for the puzzle; the denial says why. */
export const Denied: Story = {
  args: {
    denial: {
      icon: ClockIcon,
      title: "You've reached your space limit",
      body: 'Leave or end a space to open this puzzle in a new one.',
      action: { label: 'See plans', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'quota_exhausted' },
    },
  },
};
