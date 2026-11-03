import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceMembersSheetView } from './space-members-sheet-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { faces, LONG_NAME, MEMBERS, UNSYNCED } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-members',
  title: 'Screens/Spaces/People in this space',
  component: SpaceMembersSheetView,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true, controls: { exclude: ['members'] } },
  args: { visible: true, onClose: fn(), members: MEMBERS },
} satisfies Meta<typeof SpaceMembersSheetView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host (you, this tab), an idle guest, a guest, and a bot. */
export const Populated: Story = {};

/** Nobody connected yet: the sheet points at the space link. */
export const Empty: Story = { args: { members: [] } };

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
