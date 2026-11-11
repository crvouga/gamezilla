import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  SNAPSHOT,
  userDetail,
  withGameNames,
} from './synthetic-population.example';
import { SyntheticUserScreenView } from './synthetic-user-screen-view';

const meta = {
  id: 'screens-admin-synthetic-user',
  title: 'Screens/Admin/Synthetic user',
  component: SyntheticUserScreenView,
  tags: ['autodocs'],
  decorators: [withGameNames],
  parameters: {
    appRouter: true,
    controls: { exclude: ['user', 'snapshot', 'denial'] },
  },
  args: {
    loading: false,
    failed: false,
    user: userDetail(),
    snapshot: SNAPSHOT,
    canControl: true,
    canReplay: true,
    onRefresh: fn(),
    onCommand: fn(async () => undefined),
    onOpen: fn(),
  },
} satisfies Meta<typeof SyntheticUserScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A running Synthetic User mid-game, seen by an operator: who it is first
 * (face, name, Bot tag, status), then pause, resume and restart, its
 * persona, the ways to its event timeline, decision replay and UI
 * inspector, and its statechart at its live state, with its status and
 * diagnostics beside them on a desktop.
 */
export const Running: Story = {};

/** A paused user: the state row says so and no live capture is current. */
export const Paused: Story = {
  args: {
    user: userDetail({
      paused: true,
      activity: 'browsing',
      worker_id: null,
      lease_until: null,
    }),
    snapshot: null,
  },
};

/** A Synthetic User recorded before personas: the persona says so. */
export const PersonaNotRecorded: Story = {
  args: { user: userDetail({ persona: null }) },
};

/** A user that never started: every session field reads its "none" copy. */
export const NotStarted: Story = {
  args: {
    user: userDetail({
      account_id: null,
      activity: 'offline',
      checkpoint: null,
      worker_id: null,
      lease_until: null,
      application_version: null,
      last_action: null,
      generation: 0,
    }),
    snapshot: null,
  },
};

/** A user recovering after a failure: the recent failure is shown. */
export const Recovering: Story = {
  args: {
    user: userDetail({
      activity: 'recovering',
      last_error: 'Socket closed during move',
    }),
    snapshot: null,
  },
};

/** The first read has not finished; only the activity indicator, under the header's Refresh. */
export const Loading: Story = {
  args: { loading: true, user: undefined, snapshot: null },
};

/** A live update is rereading; the header's Refresh shows it and the last read stays. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed; its retry (or the header's Refresh) reads again. */
export const Failed: Story = {
  args: { failed: true, user: undefined, snapshot: null },
};

/** A later read failed: the control panel stays, with a retry above it. */
export const FailedKeepsUser: Story = { args: { failed: true } };

/** A viewer who may inspect but not control or replay. */
export const InspectOnly: Story = {
  args: { canControl: false, canReplay: false },
};

/** Long names, routes and failures wrap instead of breaking rows. */
export const LongContent: Story = {
  args: {
    user: userDetail({
      username: 'the_grand_strategist_of_rainy_tuesday_evenings',
      last_error:
        'Timed out waiting for the opponent to acknowledge the move after three reconnect attempts across two workers',
      last_action:
        'testId("custom-game-content") >> testId("custom-game-board") >> testId("custom-game-board-column-4"): tap',
    }),
  },
};

/** A person without inspect: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    user: undefined,
    snapshot: null,
    canControl: false,
    canReplay: false,
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

/** Pause asks first: the confirm dialog says what pausing does. */
export const ConfirmPause: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('synthetic-population-pause'));
    await expect(
      await canvas.findByText('Pause this Synthetic User?')
    ).toBeVisible();
    await expect(args.onCommand).not.toHaveBeenCalled();
  },
};

/** Restart asks first: the confirm dialog explains what restarting does. */
export const ConfirmRestart: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('synthetic-population-restart'));
    await expect(
      await canvas.findByText('Restart this Synthetic User?')
    ).toBeVisible();
    await expect(args.onCommand).not.toHaveBeenCalled();
  },
};

/** Restart confirmed: its dialog says the request went to the worker. */
export const RestartRequested: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('synthetic-population-restart'));
    await userEvent.click(
      await canvas.findByTestId('synthetic-population-restart-confirm')
    );
    await expect(args.onCommand).toHaveBeenCalledWith('restart');
    await expect(await canvas.findByText('Restart requested')).toBeVisible();
  },
};
