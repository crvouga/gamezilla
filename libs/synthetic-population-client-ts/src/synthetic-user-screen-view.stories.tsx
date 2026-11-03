import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  EVENTS,
  REPLAY,
  replay,
  SNAPSHOT,
  userDetail,
} from './synthetic-population.example';
import {
  SyntheticUserScreenView,
  type SyntheticUserScreenViewProps,
} from './synthetic-user-screen-view';

const RECORD = { user: userDetail(), events: EVENTS };

const meta = {
  id: 'screens-admin-synthetic-user',
  title: 'Screens/Admin/Synthetic user',
  component: SyntheticUserScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['record', 'snapshot', 'denial', 'replay'] },
  },
  args: {
    loading: false,
    failed: false,
    record: RECORD,
    snapshot: SNAPSHOT,
    canControl: true,
    replay: replay(null) as SyntheticUserScreenViewProps['replay'],
    onRefresh: fn(),
    onCommand: fn(async () => undefined),
    onInspect: fn(async () => undefined),
  },
} satisfies Meta<typeof SyntheticUserScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A running Synthetic User mid-game, seen by an operator: details, controls,
 * the statechart at its live state, events, replay and the live DOM capture.
 */
export const Running: Story = {};

/** A paused user: the state row says so and no live capture is current. */
export const Paused: Story = {
  args: {
    record: {
      user: userDetail({
        paused: true,
        activity: 'browsing',
        worker_id: null,
        lease_until: null,
      }),
      events: EVENTS,
    },
    snapshot: null,
  },
};

/** A user that never started: every session field reads its "none" copy. */
export const NotStarted: Story = {
  args: {
    record: {
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
      events: [],
    },
    snapshot: null,
  },
};

/** A user recovering after a failure: the recent failure is shown. */
export const Recovering: Story = {
  args: {
    record: {
      user: userDetail({
        activity: 'recovering',
        last_error: 'Socket closed during move',
      }),
      events: EVENTS,
    },
    snapshot: null,
  },
};

/** The first read has not finished; only the activity indicator and Refresh. */
export const Loading: Story = {
  args: { loading: true, record: undefined, snapshot: null },
};

/** A live update is rereading; the last record stays under the indicator. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed; Refresh is the way to try again. */
export const Failed: Story = {
  args: { failed: true, record: undefined, snapshot: null },
};

/** A viewer who may inspect but not control or replay. */
export const InspectOnly: Story = {
  args: { canControl: false, replay: undefined },
};

/** After a replay: reproduced, changed and unavailable choices. */
export const ReplayResults: Story = { args: { replay: replay(REPLAY) } };

/** Long names, routes and failures wrap instead of breaking rows. */
export const LongContent: Story = {
  args: {
    record: {
      user: userDetail({
        username: 'bot_with_a_really_long_username_that_keeps_on_going',
        last_error:
          'Timed out waiting for the opponent to acknowledge the move after three reconnect attempts across two workers',
        last_action:
          'tap chess-board e2-e4 then confirm the promotion dialog and wait',
      }),
      events: EVENTS,
    },
  },
};

/** A person without inspect: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    record: undefined,
    snapshot: null,
    canControl: false,
    replay: undefined,
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

/** Restart asks first: the confirm dialog explains what restarting does. */
export const ConfirmRestart: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Restart application' })
    );
    await expect(
      await canvas.findByText('Restart this Synthetic User?')
    ).toBeVisible();
    await expect(args.onCommand).not.toHaveBeenCalled();
  },
};
