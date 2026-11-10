import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  CONFIG,
  directory,
  OVERVIEW,
  withGameNames,
} from './synthetic-population.example';
import { toConfigurationDraft } from './synthetic-population-configuration';
import {
  SyntheticPopulationScreenView,
  type SyntheticPopulationScreenViewProps,
} from './synthetic-population-screen-view';

/**
 * `/admin/observatory/synthetic-users/config` renders the same view as the panel;
 * these stories cover the configuration form's validation and save states.
 */
const meta = {
  id: 'screens-admin-synthetic-population-config',
  title: 'Screens/Admin/Synthetic population config',
  component: SyntheticPopulationScreenView,
  tags: ['autodocs'],
  decorators: [withGameNames],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['overview', 'denial', 'fields', 'directory'],
    },
  },
  args: {
    loading: false,
    failed: false,
    overview: OVERVIEW,
    canConfigure: true,
    fields: toConfigurationDraft(CONFIG),
    canSave: true,
    directory: directory() as SyntheticPopulationScreenViewProps['directory'],
    onChangeField: fn(),
    onSave: fn(async () => undefined),
    onRefresh: fn(),
    canControl: false,
    onCommandAll: fn(async () => undefined),
  },
} satisfies Meta<typeof SyntheticPopulationScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An edited, valid configuration: save is offered. */
export const Editing: Story = {
  args: {
    fields: { ...toConfigurationDraft(CONFIG), desired: '48' },
  },
};

/** A cleared required number: save stays disabled until it is a whole number. */
export const MissingValue: Story = {
  args: {
    fields: { ...toConfigurationDraft(CONFIG), desired: '' },
    canSave: false,
  },
};

/** A lease shorter than the allowed minimum: save stays disabled. */
export const OutOfRange: Story = {
  args: {
    fields: { ...toConfigurationDraft(CONFIG), leaseMs: '1000' },
    canSave: false,
  },
};

const SAVE = { name: 'Save synthetic population' };

/** The save is in flight: the footer shows progress in place. */
export const Saving: Story = {
  args: {
    fields: { ...toConfigurationDraft(CONFIG), desired: '48' },
    onSave: fn(() => new Promise<void>(() => undefined)),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', SAVE));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(
      await canvas.findByRole('button', { name: 'Saving…' })
    ).toBeVisible();
  },
};

/** The server refused the save: the footer turns into a retry, work is kept. */
export const SaveFailed: Story = {
  args: {
    fields: { ...toConfigurationDraft(CONFIG), desired: '48' },
    onSave: fn(async () => {
      throw new Error(
        'Configuration could not be saved. Refresh and try again.'
      );
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', SAVE));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(canvas.getByTestId('synthetic-population-save')).toHaveAttribute(
        'data-phase',
        'error'
      )
    );
  },
};

/** A person who may view but not configure opens the config link. */
export const Denied: Story = {
  args: {
    overview: undefined,
    canConfigure: false,
    directory: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: {
        testid: 'synthetic-population-config-denied',
        reason: 'not_granted',
      },
    },
  },
};
