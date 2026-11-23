import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
  SIGN_IN_DENIAL,
} from './content-library-story.example';
import { PuzzlePacksHomeScreenView } from './puzzle-packs-home-screen-view';

const meta = {
  id: 'screens-puzzle-packs-home-mine',
  title: 'Screens/Space/Puzzle packs/Home my creations',
  component: PuzzlePacksHomeScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'mine' } },
} satisfies Meta<typeof PuzzlePacksHomeScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The person's drafts and publications, each with where it stands. */
export const Populated: Story = {};

/** Nothing built yet: what to do, and the way back to the create rows. */
export const Empty: Story = { args: LIBRARY_STORY_EMPTY };

/** More of the person's own content waits on a further page. */
export const MorePages: Story = {
  args: { more: { owned: true, attempts: false, published: false } },
};

/** Someone signed out: their own content is behind sign-in. */
export const Denied: Story = {
  args: { drafts: [], personalDenial: SIGN_IN_DENIAL },
};

/** Pressing a draft opens its builder. */
export const OpenDraft: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('content-draft-doc-draft-1')
    );
    await expect(args.onOpenDraft).toHaveBeenCalledWith('doc-draft-1');
  },
};
