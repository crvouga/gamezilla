import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentLibraryScreenView } from './content-library-screen-view';
import {
  CREATE_DENIAL,
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
  SIGN_IN_DENIAL,
  withLibraryConnection,
} from './content-library-story.example';

const meta = {
  id: 'screens-puzzles-content-library',
  title: 'Screens/Puzzles/Content library',
  component: ContentLibraryScreenView,
  tags: ['autodocs'],
  parameters: LIBRARY_STORY_PARAMETERS,
  args: LIBRARY_STORY_ARGS,
} satisfies Meta<typeof ContentLibraryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The hub a returning author sees: every list by its count, then creating. */
export const Populated: Story = {};

/** The stored library has not been read yet: one activity indicator. */
export const Loading: Story = { args: { status: 'loading' } };

/** A first visit: only the shipped starter pack, nothing started or built. */
export const Empty: Story = { args: LIBRARY_STORY_EMPTY };

/** Every list has a further page: its count says there is more. */
export const MorePages: Story = {
  args: { more: { owned: true, attempts: true, published: true } },
};

/** Syncing failed while online: the library stays usable, reconnect retries. */
export const Failed: Story = {
  decorators: [
    withLibraryConnection({
      online: true,
      lastError: 'The server did not answer. Your changes are kept.',
    }),
  ],
};

/** Offline: available puzzles and saved work stay on the device. */
export const Offline: Story = {
  decorators: [withLibraryConnection({ online: false, lastError: null })],
};

/** Someone signed out: creating is behind sign-in, said under the rows. */
export const Denied: Story = {
  args: {
    drafts: [],
    attempts: [],
    playtests: [],
    personalDenial: SIGN_IN_DENIAL,
    createDenial: CREATE_DENIAL,
  },
};

/** A long game name and pack title wrap inside the hub's rows. */
export const LongContent: Story = {
  args: {
    title: 'A counting game with a deliberately long localized name',
    bundledPacks: [
      {
        ...LIBRARY_STORY_ARGS.bundledPacks[0],
        id: 'bundled-long',
        document_id: 'bundled-long',
        kind: 'pack',
        title: 'A starter pack whose name runs well past the end of its row',
        description:
          'A long description that keeps going to show how the caption behaves when an author writes a paragraph.',
        difficulty: '',
      },
    ],
  },
};

/** A puzzle draft is being made: its row spins and every other row waits. */
export const Creating: Story = {
  args: { create: { status: 'creating', kind: 'puzzle' } },
};

/** The draft is made: a row opens it; nothing navigates on its own. */
export const Created: Story = {
  args: {
    create: { status: 'created', kind: 'puzzle', documentId: 'doc-new' },
  },
};

/** Creating was refused: the reason stays on the screen with its retry. */
export const CreateFailed: Story = {
  args: {
    create: {
      status: 'failed',
      kind: 'pack',
      message: 'The draft could not be created. Try again.',
    },
  },
};

/** Pressing a list's row opens that list. */
export const OpenList: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('content-library-tab-browse')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'browse' });
  },
};

/** Pressing a create row asks for a draft of its kind. */
export const CreatePack: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-create-pack'));
    await expect(args.onCreate).toHaveBeenCalledWith('pack');
  },
};
