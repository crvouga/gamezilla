import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { EVENTS, userDetail } from './synthetic-population.example';
import { SyntheticUserEventsScreenView } from './synthetic-user-events-screen-view';

const meta = {
  id: 'screens-admin-synthetic-user-events',
  title: 'Screens/Admin/Synthetic user events',
  component: SyntheticUserEventsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['user', 'events', 'denial'] },
  },
  args: {
    user: userDetail(),
    events: EVENTS,
    loading: false,
    failed: false,
    onRefresh: fn(),
  },
} satisfies Meta<typeof SyntheticUserEventsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Tobi_plays's recorded events, newest first. */
export const Populated: Story = {};

/** The first read is under way. */
export const Loading: Story = {
  args: { user: undefined, events: undefined, loading: true },
};

/** A live update is rereading: the rows stay and the header says so. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed: the retry reads again. */
export const Failed: Story = { args: { events: undefined, failed: true } };

/** A later read failed: the last events read stay under the retry. */
export const FailedKeepsRows: Story = { args: { failed: true } };

/** A Synthetic User that has recorded nothing yet. */
export const Empty: Story = { args: { events: [] } };

/** A person without inspect: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    user: undefined,
    events: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: {
        testid: 'synthetic-population-inspect-denied',
        reason: 'not_granted',
      },
    },
  },
};
