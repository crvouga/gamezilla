import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceMembersSheetView } from './space-members-sheet-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { faces, LONG_NAME, MEMBERS, UNSYNCED } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-members',
  title: 'Screens/Space/Manage/People',
  component: SpaceMembersSheetView,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true, controls: { exclude: ['members'] } },
  args: { visible: true, onClose: fn(), onShare: fn(), members: MEMBERS },
} satisfies Meta<typeof SpaceMembersSheetView>;
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
