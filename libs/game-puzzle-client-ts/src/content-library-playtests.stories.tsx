import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
} from './content-library-story.example';
import { PuzzlePacksHomeScreenView } from './puzzle-packs-home-screen-view';

const meta = {
  id: 'screens-puzzle-packs-home-playtests',
  title: 'Screens/Space/Puzzle packs/Home playtests',
  component: PuzzlePacksHomeScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'playtests' } },
} satisfies Meta<typeof PuzzlePacksHomeScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The practice runs of the person's own drafts. */
export const Populated: Story = {};

/** No playtest on the loaded page: where playtests are started. */
export const Empty: Story = { args: LIBRARY_STORY_EMPTY };
