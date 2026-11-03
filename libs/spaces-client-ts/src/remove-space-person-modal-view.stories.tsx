import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RemoveSpacePersonModalView } from './remove-space-person-modal-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { LONG_NAME } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-remove-person',
  title: 'Screens/Spaces/Remove person',
  component: RemoveSpacePersonModalView,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    name: 'jordan_plays',
    onClose: fn(),
    operation: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof RemoveSpacePersonModalView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host confirms before someone leaves; they may join again by link. */
export const Confirm: Story = {};

/** A long name wraps in the title instead of widening the modal. */
export const LongName: Story = { args: { name: LONG_NAME.name } };
