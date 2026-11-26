import type { JSX } from '@solidjs/web';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { useRemoveSpacePersonStep } from './remove-space-person-step';
import {
  SpaceManagementView,
  type SpaceManagementViewProps,
} from './space-management-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { HOSTED_SPACE, JORDAN, LONG_NAME } from './spaces-story.example';

function RemovePersonStory(props: {
  readonly sheet: SpaceManagementViewProps;
  readonly name: string;
}): JSX.Element {
  const removal = useRemoveSpacePersonStep({
    get name() {
      return props.name;
    },
    onClose: () => props.sheet.onClose(),
    operation: fn(() => Promise.resolve()),
  });
  return <SpaceManagementView {...props.sheet} removal={removal} />;
}

const meta = {
  id: 'screens-spaces-remove-person',
  title: 'Screens/Space/Manage/Remove person',
  component: SpaceManagementView,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    page: { area: 'people', tab: 'sharing' },
    onNavigate: fn(),
    spaceName: HOSTED_SPACE.title,
    people: null,
    sharing: null,
    onClose: fn(),
  },
  render: (args) => <RemovePersonStory sheet={args} name={JORDAN.name} />,
} satisfies Meta<typeof SpaceManagementView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host confirms before someone leaves; they may join again by link. */
export const Confirm: Story = {};

/** A long name wraps on its own line instead of widening the dialog. */
export const LongName: Story = {
  render: (args) => <RemovePersonStory sheet={args} name={LONG_NAME.name} />,
};
