import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { UserObservatoryScreenView } from './user-observatory-screen-view';

const meta = {
  id: 'screens-admin-user-observatory',
  title: 'Screens/Admin/User observatory',
  component: UserObservatoryScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['denial'] },
  },
  args: {
    onOpenOnlineNow: fn().mockName('onOpenOnlineNow'),
    canOpenSyntheticUsers: true,
    onOpenSyntheticUsers: fn().mockName('onOpenSyntheticUsers'),
  },
} satisfies Meta<typeof UserObservatoryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An operator's User Observatory: a hub that only links onward, to Online
 * now and to the Synthetic Population panel.
 */
export const Populated: Story = {};

/** A viewer who may not open the Synthetic Population panel: Online now alone. */
export const ViewOnly: Story = { args: { canOpenSyntheticUsers: false } };

/** A person without permission: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    canOpenSyntheticUsers: false,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'observatory-denied', reason: 'not_granted' },
    },
  },
};
