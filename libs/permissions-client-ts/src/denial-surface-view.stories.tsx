import {
  ClockIcon,
  KeyRoundIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { DenialSurfaceView } from './denial-surface-view';

const meta = {
  id: 'screens-permissions-denial',
  title: 'Screens/Permissions/Denial',
  component: DenialSurfaceView,
  tags: ['autodocs'],
  parameters: { controls: { exclude: ['denial'] } },
} satisfies Meta<typeof DenialSurfaceView>;
export default meta;
type Story = StoryObj<typeof meta>;

const signIn = fn().mockName('denial.action');

/** An anonymous person reaches an account-only feature; the way forward is signing in. */
export const RequiresAccount: Story = {
  args: {
    denial: {
      icon: UsersIcon,
      title: 'Sign in to add friends',
      body: 'Friends let you find each other and jump into shared spaces.',
      action: { label: 'Sign in', onPress: signIn },
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  },
};

/** A usage quota ran out; the copy says when it resets and offers the upgrade. */
export const QuotaExhausted: Story = {
  args: {
    denial: {
      icon: ClockIcon,
      title: "You've hit today's puzzle limit",
      body: 'Sign in free for unlimited puzzles, or come back tomorrow.',
      action: { label: 'Sign in', onPress: signIn },
      dataSet: { testid: 'permission-denial', reason: 'quota_exhausted' },
    },
  },
};

/** A denial with nothing to unlock: no action, only an explanation. */
export const NotGranted: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Only the puzzle team can load puzzles',
      dataSet: { testid: 'permission-denial', reason: 'not_granted' },
    },
  },
};

/** The inline form, for a denial inside a card or form instead of a whole screen. */
export const Compact: Story = {
  args: { ...RequiresAccount.args, variant: 'compact' },
};

/** Pressing the way forward runs the configured unlock exactly once. */
export const TakeTheWayForward: Story = {
  args: RequiresAccount.args,
  play: async ({ canvasElement }) => {
    signIn.mockClear();
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Sign in' })
    );
    await expect(signIn).toHaveBeenCalledTimes(1);
  },
};
