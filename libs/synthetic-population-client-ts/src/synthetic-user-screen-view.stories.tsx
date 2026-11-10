import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  EVENTS,
  REPLAY,
  replay,
  SNAPSHOT,
  userDetail,
  withGameNames,
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
  decorators: [withGameNames],
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
 * A running Synthetic User mid-game, seen by an operator: who it is first
 * (face, name, Bot tag, status), then its control panel, persona, events,
 * replay, statechart at its live state and live DOM capture, with its
 * status and diagnostics beside them on a desktop.
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

/** A Synthetic User recorded before personas: the persona says so. */
export const PersonaNotRecorded: Story = {
  args: {
    record: { user: userDetail({ persona: null }), events: EVENTS },
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

/** The first read has not finished; only the activity indicator, under the header's Refresh. */
export const Loading: Story = {
  args: { loading: true, record: undefined, snapshot: null },
};

/** A live update is rereading; the header's Refresh shows it and the last record stays. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed; its retry (or the header's Refresh) reads again. */
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
        username: 'the_grand_strategist_of_rainy_tuesday_evenings',
        last_error:
          'Timed out waiting for the opponent to acknowledge the move after three reconnect attempts across two workers',
        last_action:
          'testId("custom-game-content") >> testId("custom-game-board") >> testId("custom-game-board-column-4"): tap',
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
    await userEvent.click(canvas.getByRole('button', { name: 'Restart' }));
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
