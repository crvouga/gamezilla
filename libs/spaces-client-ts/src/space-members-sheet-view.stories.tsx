import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PeopleExample } from './space-management.example';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { faces, LONG_NAME, MEMBERS, UNSYNCED } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-members',
  title: 'Screens/Space/Manage/People',
  component: PeopleExample,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true, controls: { exclude: ['members'] } },
  args: {
    onClose: fn(),
    onShare: fn(),
    onRemove: fn(),
    members: MEMBERS,
  },
} satisfies Meta<typeof PeopleExample>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host (you, this tab), an idle guest, a guest, and a bot. */
export const Populated: Story = {};

/** Nobody connected yet: Share sits right under the invitation. */
export const Empty: Story = { args: { members: [] } };

/** From the empty list, Share opens the space link in one press. */
export const ShareFromEmpty: Story = {
  args: { members: [] },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const sheet = await body.findByRole('dialog', {
      name: 'People in this space',
    });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await expect(args.onShare).toHaveBeenCalledTimes(1);
  },
};

/** A long name truncates; a profile not on this device shows a plain face. */
export const LongContent: Story = {
  args: {
    members: [
      ...MEMBERS,
      ...faces([LONG_NAME, UNSYNCED]).map((face) => ({
        ...face,
        isYou: false,
        isThisTab: false,
        idle: true,
        isHost: false,
      })),
    ],
  },
};

/** J8 from People: the host's Remove on a guest's row starts removing them. */
export const RemoveFromPeople: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const sheet = await body.findByRole('dialog', {
      name: 'People in this space',
    });
    const [remove] = within(sheet).getAllByRole('button', { name: 'Remove' });
    await userEvent.click(remove as HTMLElement);
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};

export const Settings: Story = {
  args: { settings: true, onRename: fn() },
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole('dialog', {
        name: 'Space settings',
      })
    );
    await userEvent.click(dialog.getByRole('tab', { name: 'People' }));
    await expect(dialog.getByText('This device')).toBeVisible();
    await userEvent.click(dialog.getByRole('tab', { name: 'Sharing' }));
    await expect(
      dialog.getByRole('button', { name: 'Copy link' })
    ).toBeVisible();
    await userEvent.click(dialog.getByRole('tab', { name: 'General' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Edit name' }));
    await expect(args.onRename).toHaveBeenCalled();
  },
};
