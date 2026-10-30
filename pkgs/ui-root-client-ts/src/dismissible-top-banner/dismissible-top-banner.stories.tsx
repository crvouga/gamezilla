import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { P } from '../text/index';
import Example from './dismissible-top-banner.example';
import { DismissibleBanner, DismissibleBannerPortalProvider } from './index';

const meta = {
  id: 'components-feedback-dismissiblebanner',
  title: 'Molecules/DismissibleBanner',
  component: DismissibleBanner,
  tags: ['autodocs'],
  parameters: { test: { restoreMocks: false } },
  args: {
    visible: true,
    title: 'A new version is ready',
    subtitle: 'Reload to get the latest fixes.',
    actionLabel: 'Reload',
    position: 'top',
    tone: 'paper',
    onDismiss: fn(),
    onActionClick: fn(),
  },
  argTypes: {
    visible: { control: 'boolean' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    actionLabel: { control: 'text' },
    position: { control: 'inline-radio', options: ['top', 'bottom'] },
    tone: { control: 'inline-radio', options: ['paper', 'info', 'warning'] },
    onDismiss: { control: false },
    onActionClick: { control: false },
    dataSet: { control: false },
    actionDataSet: { control: false },
  },
} satisfies Meta<typeof DismissibleBanner>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Position, tone and visibility belong to Controls rather than demo-only widgets. */
export const Interactive: StoryObj<typeof meta> = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <DismissibleBannerPortalProvider>
        <P>Page content stays available when the banner is dismissed.</P>
        <DismissibleBanner
          {...args}
          onDismiss={() => {
            args.onDismiss();
            updateArgs({ visible: false });
          }}
        />
      </DismissibleBannerPortalProvider>
    );
  },
};

export const Dismiss: StoryObj<typeof meta> = {
  ...Interactive,
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onActionClick)?.mockClear();
    mocked(args.onDismiss).mockClear();
    const canvas = within(canvasElement);
    await step('Run the action, then dismiss the banner', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Reload' }));
      await expect(args.onActionClick).toHaveBeenCalledTimes(1);
      await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
      await expect(
        canvas.queryByText('A new version is ready')
      ).not.toBeInTheDocument();
      await expect(args.onDismiss).toHaveBeenCalledTimes(1);
    });
  },
};
