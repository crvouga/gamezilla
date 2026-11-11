import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SyntheticPopulationScreenView } from './synthetic-population-screen-view';

const meta = {
  id: 'screens-admin-synthetic-population',
  title: 'Screens/Admin/Synthetic population',
  component: SyntheticPopulationScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['denial'] } },
  args: { canConfigure: true, onOpen: fn() },
} satisfies Meta<typeof SyntheticPopulationScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An operator's Synthetic Population panel: links to the Synthetic Users,
 * the workers and the recorded events, and to the population settings.
 */
export const Operator: Story = {};

/** A person who may observe but not configure: no way to the settings form. */
export const ViewOnly: Story = { args: { canConfigure: false } };

/** A person without permission: the denial replaces the panel. */
export const Denied: Story = {
  args: {
    canConfigure: false,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'synthetic-population-denied', reason: 'not_granted' },
    },
  },
};
