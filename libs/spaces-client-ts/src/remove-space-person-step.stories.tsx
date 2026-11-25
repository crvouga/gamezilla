import type { JSX } from '@solidjs/web';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { useRemoveSpacePersonStep } from './remove-space-person-step';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import { SpaceShareSheetView } from './space-share-sheet-view';
import { AVERY, JORDAN, LONG_NAME, PLAYBOT } from './spaces-story.example';

type RemovePersonStoryProps = {
  /** The shown name of the person being removed. */
  readonly name: string;
  readonly onClose: () => void;
  readonly operation: () => Promise<void>;
};

/** The Share dialog on its Remove person step, as the host sees it. */
function RemovePersonStory(props: RemovePersonStoryProps): JSX.Element {
  const removal = useRemoveSpacePersonStep({
    get name() {
      return props.name;
    },
    onClose: () => props.onClose(),
    operation: () => props.operation(),
  });
  return (
    <SpaceShareSheetView
      open
      onClose={fn()}
      onCopyLink={fn(() => Promise.resolve())}
      canManage
      peopleStatus="ready"
      people={[AVERY, JORDAN, PLAYBOT]}
      hostId={AVERY.id}
      viewerId={AVERY.id}
      onRemovePerson={fn()}
      removal={removal}
    />
  );
}

const meta = {
  id: 'screens-spaces-remove-person',
  title: 'Screens/Space/Manage/Remove person',
  component: RemovePersonStory,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    name: 'jordan_plays',
    onClose: fn(),
    operation: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof RemovePersonStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host confirms before someone leaves; they may join again by link. */
export const Confirm: Story = {};

/** A long name wraps on its own line instead of widening the dialog. */
export const LongName: Story = { args: { name: LONG_NAME.name } };
