import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PACK,
  AUTHOR_STORY_PARAMETERS,
  renderAuthorStory,
} from './content-author-story.example';
import {
  type ContentPackPreviewItem,
  ContentPackPreviewView,
} from './content-pack-preview';
import { StoryCountingPlayer } from './content-story.example';

const meta = {
  id: 'screens-puzzles-content-author-preview',
  title: 'Screens/Space/SpaceGamePuzzlePackBuilder/Preview',
  component: ContentAuthorScreenView,
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: {
    ...AUTHOR_STORY_ARGS,
    place: { screen: 'preview', puzzleId: null },
  },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The pack's three counting puzzles; the last is still a draft. */
const PACK_ITEMS: readonly ContentPackPreviewItem[] = [
  { id: 'puzzle-count-to-five', title: 'Count to five', published: true },
  { id: 'puzzle-count-to-seven', title: 'Count to seven', published: true },
  { id: 'puzzle-count-to-nine', title: 'Count to nine', published: false },
];

/** A puzzle draft as a solver sees it: its board, nothing to change. */
export const Puzzle: Story = {};

/** A pack draft: its puzzles, each opening its own preview. */
export const Pack: Story = {
  args: AUTHOR_STORY_PACK,
  render: (args) =>
    renderAuthorStory(args, {
      slots: () => ({
        preview: (
          <ContentPackPreviewView
            items={PACK_ITEMS}
            previewed={null}
            onSelect={fn()}
            onBack={fn()}
          />
        ),
      }),
    }),
};

/** One of a pack's puzzles, named with its place in the pack, previewed. */
export const PackPuzzle: Story = {
  args: {
    ...AUTHOR_STORY_PACK,
    place: { screen: 'preview', puzzleId: 'puzzle-count-to-seven' },
  },
  render: (args) =>
    renderAuthorStory(args, {
      slots: () => ({
        preview: (
          <ContentPackPreviewView
            items={PACK_ITEMS}
            previewed={{
              title: 'Count to seven',
              position: 2,
              board: <StoryCountingPlayer state="count:0" disabled />,
            }}
            onSelect={fn()}
            onBack={fn()}
          />
        ),
      }),
    }),
};
