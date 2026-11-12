import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BugReportFormView } from './bug-report-form';
import { autoScreenshot, fullScreenshots } from './bug-report-form.example';
import { DISCARD } from './copy';

const meta = {
  id: 'product-bug-report',
  title: 'Organisms/Bug report',
  component: BugReportFormView,
  tags: ['autodocs'],
  args: {
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
} satisfies Meta<typeof BugReportFormView>;
export default meta;
type Story = StoryObj<typeof meta>;

const described = 'The board froze after I castled, and my clock kept running.';

/** Just opened: the screenshot of what the app was showing is already there. */
export const Opened: Story = {};

/** Described and ready to send. */
export const Described: Story = { args: { description: described } };

/** The device could not take a screenshot; the bug report still goes. */
export const NoScreenshot: Story = { args: { screenshots: [] } };

/** Four screenshots: as many as one bug report carries. */
export const FullOfScreenshots: Story = {
  args: { description: described, screenshots: fullScreenshots },
};

/** A fifth picture was refused. */
export const TooManyScreenshots: Story = {
  args: {
    description: described,
    screenshots: fullScreenshots,
    notice: 'too-many',
  },
};

/** Something that is not a picture was refused. */
export const NotAPicture: Story = {
  args: { description: described, notice: 'not-a-picture' },
};

/** A picture too large to send was refused. */
export const PictureTooLarge: Story = {
  args: { description: described, notice: 'too-large' },
};

/** A chosen picture is still being saved. */
export const AddingPicture: Story = {
  args: { description: described, adding: 1 },
};

/** Sending without a description is refused, and says why. */
export const DescriptionNeeded: Story = { args: { notice: 'describe' } };

/** On its way to the team. */
export const Sending: Story = {
  args: { description: described, phase: 'sending' },
};

/** The team has it. */
export const Sent: Story = { args: { phase: 'done', notice: 'sent' } };

/** Sent while offline: kept, and sent once back online. */
export const KeptWhileOffline: Story = {
  args: { phase: 'done', notice: 'offline', waiting: 1 },
};

/** The team could not receive it: kept, and sent later. */
export const KeptForLater: Story = {
  args: { phase: 'done', notice: 'later', waiting: 1 },
};

/** Earlier bug reports are still waiting to be sent. */
export const OthersWaiting: Story = { args: { waiting: 2 } };

/** Ten bug reports today: this one is kept, and sent once the limit starts again. */
export const DailyLimitReached: Story = {
  args: { phase: 'done', notice: 'limit', waiting: 1 },
};

/** A description at its 4,000 characters says it is full. */
export const DescriptionFull: Story = {
  args: { description: 'The board froze. '.repeat(236).slice(0, 4000) },
};

/** The bug report could not be sent at all; nothing written is lost. */
export const Failed: Story = {
  args: { description: described, notice: 'failed' },
};

/** Typing describes the bug; sending hands it over. */
export const DescribeAndSend: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByRole('textbox', { name: 'What happened?' }),
      'It froze'
    );
    await expect(args.onDescribe).toHaveBeenLastCalledWith('It froze');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send bug report' })
    );
    await expect(args.onSend).toHaveBeenCalledOnce();
  },
};

/** Discarding a draft asks first: it cannot be undone. */
export const DiscardAsked: Story = {
  args: { description: described },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole('button', { name: DISCARD.action })
    );
    await expect(await page.findByText(DISCARD.title)).toBeVisible();
    await expect(args.onDiscard).not.toHaveBeenCalled();
  },
};

/** Confirming gives the draft up for good. */
export const Discarded: Story = {
  args: { description: described },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole('button', { name: DISCARD.action })
    );
    await userEvent.click(
      await page.findByTestId('bug-report-discard-confirm')
    );
    await expect(args.onDiscard).toHaveBeenCalledOnce();
  },
};

/** Keeping the draft leaves it as it was. */
export const DiscardDeclined: Story = {
  args: { description: described },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole('button', { name: DISCARD.action })
    );
    await userEvent.click(await page.findByTestId('bug-report-discard-keep'));
    await expect(args.onDiscard).not.toHaveBeenCalled();
  },
};

/** A screenshot the person does not want sent is removed. */
export const RemoveScreenshot: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Remove screenshot 1' })
    );
    await expect(args.onRemoveScreenshot).toHaveBeenCalledWith('auto');
  },
};
