import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PACK,
  AUTHOR_STORY_PARAMETERS,
  PUBLICATION_PUBLISHED,
  PUBLICATION_READY,
  renderAuthorStory,
} from './content-author-story.example';
import { COUNTING_BODY } from './content-story.example';

const meta = {
  id: 'screens-puzzles-content-author',
  title: 'Screens/Puzzles/Content author',
  component: ContentAuthorScreenView,
  tags: ['autodocs'],
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: AUTHOR_STORY_ARGS,
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A saved draft's steps, each with where it stands; playtesting comes next. */
export const Editing: Story = {};

/** The library is still being read. */
export const Loading: Story = { args: { status: 'loading' } };

/** Someone who may not edit this draft sees why instead of the builder. */
export const Denied: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Only the author can edit this draft',
      dataSet: { testid: 'permission-denial', reason: 'not_granted' },
    },
  },
};

/** The working copy has not reached this device; the way back is offered. */
export const Missing: Story = { args: { status: 'missing' } };

/** The draft was removed: said plainly, with the way back. */
export const Gone: Story = { args: { status: 'gone' } };

/** An edit is waiting to be saved. */
export const Unsaved: Story = {
  args: { save: { saving: false, dirty: true, error: null } },
};

/** The draft is saving; the save line says so on every place. */
export const Saving: Story = {
  args: {
    save: { saving: true, dirty: true, error: null },
    disabled: true,
  },
};

const SAVE_FAILED = {
  save: {
    saving: false,
    dirty: true,
    error: 'The draft could not be saved. Try saving again.',
  },
} as const;

/** The save failed: the edits stay, with a retry, on every place. */
export const SaveFailed: Story = { args: SAVE_FAILED };

/** Another device kept a different working copy: choose one first. */
export const Conflicted: Story = { args: { conflicted: true } };

/** A new draft with no title and a board the game cannot play yet. */
export const NeedsFixing: Story = {
  args: {
    body: { ...COUNTING_BODY, title: '', description: '', difficulty: '' },
    playable: false,
    previewable: false,
  },
};

/** The draft passed its check with a finished playtest: publishing is next. */
export const Validated: Story = {
  render: (args) => renderAuthorStory(args, { publication: PUBLICATION_READY }),
};

/** The check found problems: validating again is next. */
export const ValidationFailed: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: { proven: true, validation: 'invalid' },
    }),
};

/** Sent, and waiting for the server's confirmation: nothing to press. */
export const PublishPending: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        ...PUBLICATION_READY,
        pending: 'online',
        copyState: { kind: 'pending', connection: 'online' },
      },
    }),
};

/** Sent while offline: it waits for the connection, the draft is kept. */
export const PublishPendingOffline: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        ...PUBLICATION_READY,
        pending: 'offline',
        copyState: { kind: 'pending', connection: 'offline' },
      },
    }),
};

/** The server refused the publication; the card says why on every place. */
export const PublishRefused: Story = {
  render: (args) =>
    renderAuthorStory(args, { publication: PUBLICATION_READY, refused: true }),
};

/** An edition is out: viewing it is the next thing to do. */
export const Published: Story = {
  render: (args) =>
    renderAuthorStory(args, { publication: PUBLICATION_PUBLISHED }),
};

/** A pack: its puzzles counted, and a draft puzzle to finish first. */
export const PackBuilder: Story = {
  args: AUTHOR_STORY_PACK,
  render: (args) =>
    renderAuthorStory(args, {
      publication: { waitingOn: ['Count to nine'] },
    }),
};

/** An untitled draft is named so, and a long title wraps in the header. */
export const LongContent: Story = {
  args: {
    body: {
      ...COUNTING_BODY,
      title:
        'Count all the way to ninety-nine without overshooting, a very long title',
    },
  },
};

/** Saving again after a failure retries the save. */
export const SaveAgain: Story = {
  args: SAVE_FAILED,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Save again'));
    await expect(args.onSaveAgain).toHaveBeenCalled();
  },
};

/** Pressing a step's row opens that step. */
export const OpenStep: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-open-board'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'board' });
  },
};

/** The next step's command leads to where that step is taken. */
export const OpenNextStep: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-author-next'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'publish' });
  },
};

/** A pack's next step opens its first draft puzzle. */
export const OpenWaitingPuzzle: Story = {
  ...PackBuilder,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-open-waiting'));
    await expect(args.onOpenWaiting).toHaveBeenCalled();
  },
};
