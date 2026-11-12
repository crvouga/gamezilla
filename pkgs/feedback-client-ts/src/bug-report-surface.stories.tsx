import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { autoScreenshot, fullScreenshots } from './bug-report-form.example';
import { BugReportSurfaceView } from './bug-report-surface';
import { withAppBehind } from './bug-report-surface.example';

const meta = {
  id: 'product-bug-report-surface',
  title: 'Organisms/Bug report surface',
  component: BugReportSurfaceView,
  tags: ['autodocs', 'viewport-responsive'],
  decorators: [withAppBehind],
  parameters: { appRouter: true },
  args: {
    visible: true,
    description: '',
    screenshots: autoScreenshot,
    adding: 0,
    phase: 'draft',
    notice: null,
    waiting: 0,
    onDescribe: fn(),
    onAddPicture: fn(),
    onRemoveScreenshot: fn(),
    onSend: fn(),
    onDiscard: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof BugReportSurfaceView>;
export default meta;
type Story = StoryObj<typeof meta>;

const described = 'The board froze after I castled, and my clock kept running.';

/** Just opened, by shaking or by choosing Report a bug: a sheet on a phone, a dialog on a wider screen. */
export const Opened: Story = {};

/** Described, with every screenshot a bug report carries, ready to send. */
export const ReadyToSend: Story = {
  args: { description: described, screenshots: fullScreenshots },
};

/** Sending without a description is refused in place. */
export const DescriptionNeeded: Story = { args: { notice: 'describe' } };

/** The team has it; Done puts the bug report away. */
export const Sent: Story = { args: { phase: 'done', notice: 'sent' } };

/** Sent while offline: kept on the device until it can be sent. */
export const KeptWhileOffline: Story = {
  args: { phase: 'done', notice: 'offline', waiting: 1 },
};

/** The close button puts the bug report away and keeps what was written. */
export const Close: Story = {
  args: { description: described },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const close = await page.findByTestId('bug-report-close');
    await userEvent.click(close);
    await expect(args.onClose).toHaveBeenCalled();
  },
};
