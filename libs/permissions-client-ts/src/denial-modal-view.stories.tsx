import { ClockIcon, KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { DenialModalView } from './denial-modal-view';
import { withScreenBehind } from './permissions-story.example';

const signIn = fn().mockName('denial.action');

const meta = {
  id: 'screens-permissions-denial-modal',
  title: 'Screens/Permissions/Denial modal',
  component: DenialModalView,
  tags: ['autodocs'],
  decorators: [withScreenBehind],
  parameters: { controls: { exclude: ['denial'] } },
  args: {
    visible: true,
    onDismiss: fn(),
    denial: {
      icon: KeyRoundIcon,
      title: 'Get Plus to host more spaces',
      body: 'You can host one space at a time. End it to start another, or get Plus to host as many as you like.',
      action: { label: 'See plans', onPress: signIn },
      dataSet: { testid: 'hosting-denied', reason: 'limit_reached' },
    },
  },
} satisfies Meta<typeof DenialModalView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A refused attempt with a configured way forward beside "Not now". */
export const WithWayForward: Story = {};

/** A refusal that unlocks nothing: only an explanation and "OK". */
export const WithoutWayForward: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Finish your current multiplayer game first',
      dataSet: { testid: 'permission-denial', reason: 'limit_reached' },
    },
  },
};

/** A used-up quota: the body says when it resets, with the upgrade offered. */
export const QuotaReset: Story = {
  args: {
    denial: {
      icon: ClockIcon,
      title: "You've used this for now",
      body: 'Resets in 4 h',
      action: { label: 'Sign in', onPress: signIn },
      dataSet: { testid: 'permission-denial', reason: 'quota_exhausted' },
    },
  },
};

/** Taking the way forward closes the modal first, then runs the unlock once. */
export const TakeTheWayForward: Story = {
  play: async ({ args, canvasElement }) => {
    signIn.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'See plans' })
    );
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
    await expect(signIn).toHaveBeenCalledTimes(1);
  },
};
