import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ShakeSettingView } from './shake-setting';

const meta = {
  id: 'product-shake-to-report',
  title: 'Molecules/Shake to report',
  component: ShakeSettingView,
  tags: ['autodocs'],
  args: { state: 'on', onChange: fn() },
} satisfies Meta<typeof ShakeSettingView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Shaking the phone opens a bug report. */
export const On: Story = {};

/** Turned off by the person. */
export const Off: Story = { args: { state: 'off' } };

/** A phone that asks first: off until the person turns it on and allows it. */
export const NeedsPermission: Story = { args: { state: 'needs-permission' } };

/** The phone refused: the person is told how to report a bug without shaking. */
export const Refused: Story = { args: { state: 'refused' } };

/** The switch asks for shake to be turned off. */
export const TurnOff: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('switch', { name: 'Shake to report a bug' })
    );
    await expect(args.onChange).toHaveBeenCalledWith(false);
  },
};
