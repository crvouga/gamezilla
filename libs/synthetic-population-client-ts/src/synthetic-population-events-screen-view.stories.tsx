import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { EVENTS } from './synthetic-population.example';
import { SyntheticPopulationEventsScreenView } from './synthetic-population-events-screen-view';

const meta = {
  id: 'screens-admin-synthetic-population-events',
  title: 'Screens/Admin/Synthetic population events',
  component: SyntheticPopulationEventsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['events', 'denial'] },
  },
  args: { events: EVENTS, loading: false, failed: false, onRefresh: fn() },
} satisfies Meta<typeof SyntheticPopulationEventsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What the population recorded, newest first. */
export const Populated: Story = {};

/** The first read is under way. */
export const Loading: Story = { args: { events: undefined, loading: true } };

/** A live update is rereading: the rows stay and the header says so. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed: the retry reads again. */
export const Failed: Story = { args: { events: undefined, failed: true } };

/** A later read failed: the last events read stay under the retry. */
export const FailedKeepsRows: Story = { args: { failed: true } };

/** Nothing recorded yet. */
export const Empty: Story = { args: { events: [] } };

/** An event opened: its correlation and context, read-only. */
export const EventOpened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Open MoveSubmitted'));
    await expect(
      await canvas.findByTestId('synthetic-population-event-context')
    ).toBeVisible();
  },
};

/** A person without permission: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    events: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'synthetic-population-denied', reason: 'not_granted' },
    },
  },
};
