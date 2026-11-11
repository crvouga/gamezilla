import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentLibraryScreenView } from './content-library-screen-view';
import {
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
} from './content-library-story.example';

const meta = {
  id: 'screens-puzzles-content-library-playtests',
  title: 'Screens/Puzzles/Content library/Playtests',
  component: ContentLibraryScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'playtests' } },
} satisfies Meta<typeof ContentLibraryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The practice runs of the person's own drafts. */
export const Populated: Story = {};

/** No playtest on the loaded page: where playtests are started. */
export const Empty: Story = { args: LIBRARY_STORY_EMPTY };
