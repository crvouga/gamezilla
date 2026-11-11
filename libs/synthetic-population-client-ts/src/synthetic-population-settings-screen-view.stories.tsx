import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CONFIG } from './synthetic-population.example';
import { toConfigurationDraft } from './synthetic-population-configuration';
import { SyntheticPopulationSettingsScreenView } from './synthetic-population-settings-screen-view';

/**
 * `/admin/observatory/synthetic-users/settings`: the desired synthetic
 * population form, alone on its screen. The story id keeps its earlier
 * name (`…-config`), which the Storybook integration checks open.
 */
const meta = {
  id: 'screens-admin-synthetic-population-config',
  title: 'Screens/Admin/Synthetic population settings',
  component: SyntheticPopulationSettingsScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['denial', 'fields'] },
  },
  args: {
    ready: true,
    loading: false,
    failed: false,
    onRetry: fn(),
    fields: toConfigurationDraft(CONFIG),
    canSave: true,
    onChangeField: fn(),
    onSave: fn(async () => undefined),
    onCancel: fn(),
  },
} satisfies Meta<typeof SyntheticPopulationSettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An edited, valid configuration: save is offered. */
export const Editing: Story = {
  args: { fields: { ...toConfigurationDraft(CONFIG), desired: '48' } },
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

/**
 * The first read has not finished: the form waits for the saved
 * configuration, so Save stays disabled.
 */
export const Loading: Story = {
  args: { ready: false, loading: true, canSave: false },
};

/**
 * The first read failed: nothing known can be saved over, so Save stays
 * disabled and the retry reads again.
 */
export const Failed: Story = {
  args: { ready: false, failed: true, canSave: false },
};

/** A person who may view but not configure opens the settings link. */
export const Denied: Story = {
  args: {
    ready: false,
    canSave: false,
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
