import type { JSX } from '@solidjs/web';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { useRemoveSpacePersonStep } from './remove-space-person-step';
import type { SharingExampleProps } from './space-management.example';
import { SharingExample } from './space-management.example';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { AVERY, JORDAN, LONG_NAME, PLAYBOT } from './spaces-story.example';

function RemovePersonStory(props: {
  readonly sheet: SharingExampleProps;
  readonly name: string;
}): JSX.Element {
  const removal = useRemoveSpacePersonStep({
    get name() {
      return props.name;
    },
    onClose: () => props.sheet.onClose(),
    operation: fn(() => Promise.resolve()),
  });
  return <SharingExample {...props.sheet} removal={removal} />;
}

const meta = {
  id: 'screens-spaces-remove-person',
  title: 'Screens/Space/Manage/Remove person',
  component: SharingExample,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    onCopyLink: fn(() => Promise.resolve()),
    canManage: true,
    peopleStatus: 'ready',
    people: [AVERY, JORDAN, PLAYBOT],
    hostId: AVERY.id,
    viewerId: AVERY.id,
    onRemovePerson: fn(),
    onClose: fn(),
  },
  render: (args) => <RemovePersonStory sheet={args} name={JORDAN.name} />,
} satisfies Meta<typeof SharingExample>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host confirms before someone leaves; they may join again by link. */
export const Confirm: Story = {};

/** A long name wraps on its own line instead of widening the dialog. */
export const LongName: Story = {
  render: (args) => <RemovePersonStory sheet={args} name={LONG_NAME.name} />,
};
