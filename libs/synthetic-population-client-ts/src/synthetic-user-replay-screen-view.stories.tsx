import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { REPLAY, userDetail } from './synthetic-population.example';
import { SyntheticUserReplayScreenView } from './synthetic-user-replay-screen-view';

const meta = {
  id: 'screens-admin-synthetic-user-replay',
  title: 'Screens/Admin/Synthetic user replay',
  component: SyntheticUserReplayScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['user', 'result', 'denial'] },
  },
  args: {
    user: userDetail(),
    result: null,
    onReplay: fn(async () => undefined),
  },
} satisfies Meta<typeof SyntheticUserReplayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the first replay: the table says so and what replaying shows. */
export const NotReplayed: Story = {};

/** After a replay: reproduced, changed and unavailable choices. */
export const Replayed: Story = { args: { result: REPLAY } };

/** A replay that found no recorded decisions. */
export const NoDecisions: Story = {
  args: { result: { ...REPLAY, decisions: [] } },
};

/** A person without replay: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    user: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: {
        testid: 'synthetic-population-replay-denied',
        reason: 'not_granted',
      },
    },
  },
};
