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

const meta = {
  id: 'screens-puzzles-content-author-publish',
  title: 'Screens/Puzzles/Content author/Publish',
  component: ContentAuthorScreenView,
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: { ...AUTHOR_STORY_ARGS, place: { screen: 'publish' } },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new puzzle draft: its playtest is the one next step, then the rest. */
export const Playtest: Story = {};

/** The board cannot be played yet: fixing it comes before the playtest. */
export const FixFirst: Story = {
  args: { playable: false },
  render: (args) =>
    renderAuthorStory(args, { publication: { playable: false } }),
};

/** A finished playtest proves it: validating is next. */
export const Proven: Story = {
  render: (args) => renderAuthorStory(args, { publication: { proven: true } }),
};

/** The draft passed validation and a completed playtest proves it. */
export const Validated: Story = {
  render: (args) => renderAuthorStory(args, { publication: PUBLICATION_READY }),
};

/** Validation found problems; the check's own message says what to fix. */
export const ValidationFailed: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        proven: true,
        validation: 'invalid',
        validationMessage: 'The target must be a number from 2 to 9.',
      },
    }),
};

/** Published and waiting for the server's confirmation while online. */
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

/** Published while offline: it waits for the connection, the draft is kept. */
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

/** The server refused the publication; the shell's card says why. */
export const PublishRefused: Story = {
  render: (args) =>
    renderAuthorStory(args, { publication: PUBLICATION_READY, refused: true }),
};

/** An edition is out: it can be viewed or withdrawn from discovery. */
export const Published: Story = {
  render: (args) =>
    renderAuthorStory(args, { publication: PUBLICATION_PUBLISHED }),
};

/** The author may draft but not publish; the denial replaces Publish. */
export const PublishDenied: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        publishDenial: {
          icon: KeyRoundIcon,
          title: 'Publishing needs a verified account',
          dataSet: { testid: 'permission-denial', reason: 'not_granted' },
        },
      },
    }),
};

/** A pack waits on a draft puzzle: finishing it is the lead. */
export const PackWaiting: Story = {
  args: AUTHOR_STORY_PACK,
  render: (args) =>
    renderAuthorStory(args, {
      publication: { waitingOn: ['Count to nine'] },
    }),
};

/** The draft is saving: every action waits for it. */
export const Saving: Story = {
  args: { save: { saving: true, dirty: true, error: null }, disabled: true },
};

/** Withdrawing asks first, in a destructive confirm the shell owns. */
export const ConfirmWithdraw: Story = {
  ...Published,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-withdraw'));
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByText('Withdraw this publication?')
    ).toBeVisible();
  },
};

/** The current copy's receipt is still hydrating; its local edition is not proof of confirmation. */
export const PublicationReading: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        ...PUBLICATION_READY,
        published: true,
        copyState: { kind: 'reading' },
      },
    }),
};

/** Edited work remains publishable while a different saved copy waits offline. */
export const OlderPublicationPending: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        ...PUBLICATION_READY,
        published: true,
        pending: 'offline',
        copyState: { kind: 'draft' },
      },
    }),
};

/** A newer saved working copy coexists with the already published edition. */
export const NewDraftAfterPublication: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        ...PUBLICATION_READY,
        published: true,
        copyState: { kind: 'draft' },
      },
    }),
};

/** This unchanged older copy was published; repeating its request cannot replace a later edition. */
export const PreviouslyPublishedCopy: Story = {
  render: (args) =>
    renderAuthorStory(args, {
      publication: {
        ...PUBLICATION_READY,
        published: true,
        copyState: { kind: 'edition', current: false },
      },
    }),
};
