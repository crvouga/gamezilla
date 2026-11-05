import { RefusedChangeCard } from '@libs/app-env-client-ts/refused-change-notice';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ContentAuthorScreenView,
  type ContentAuthorScreenViewProps,
} from './content-author-screen-view';
import {
  ContentPublicationControlsView,
  type ContentPublicationControlsViewProps,
} from './content-publication-controls-view';
import {
  COUNTING_BODY,
  StoryCountingEditor,
  StoryCountingPlayer,
  StoryDraftHistory,
  StoryKeptCopies,
  StoryPackEditor,
  StoryPlaytest,
} from './content-story.example';

const DOCUMENT_ID = '5d0c1a00-0000-4000-8000-0000000000a1';

/** Validation and publication of the draft, with nothing in flight. */
function publication(
  overrides: Partial<ContentPublicationControlsViewProps> = {}
) {
  return (
    <ContentPublicationControlsView
      kind="puzzle"
      validation="unchecked"
      validationMessage=""
      proven={false}
      pending={null}
      published={false}
      disabled={false}
      onValidate={fn(async () => undefined)}
      onPublish={fn(async () => undefined)}
      onViewPublication={fn()}
      onWithdraw={fn(async () => undefined)}
      {...overrides}
    />
  );
}

type Slots = Pick<
  ContentAuthorScreenViewProps,
  'history' | 'playtest' | 'publication' | 'stage' | 'keptCopies'
>;

/**
 * Renders the view with fresh smart-widget stand-ins per mount; `slots`
 * replaces some of them for one state.
 */
function renderWith(
  args: ContentAuthorScreenViewProps,
  slots: () => Partial<Slots> = () => ({})
) {
  const chosen = slots();
  return (
    <ContentAuthorScreenView
      {...args}
      history={chosen.history ?? <StoryDraftHistory />}
      playtest={chosen.playtest ?? <StoryPlaytest />}
      publication={chosen.publication ?? publication()}
      stage={chosen.stage ?? <StoryCountingEditor target="7" />}
      keptCopies={chosen.keptCopies ?? <StoryKeptCopies />}
    />
  );
}

const meta = {
  id: 'screens-puzzles-content-author',
  title: 'Screens/Puzzles/Content author',
  component: ContentAuthorScreenView,
  tags: ['autodocs'],
  render: (args) => renderWith(args),
  parameters: {
    appRouter: true,
    controls: {
      exclude: [
        'denial',
        'body',
        'save',
        'history',
        'playtest',
        'publication',
        'stage',
        'keptCopies',
      ],
    },
  },
  args: {
    status: 'ready',
    documentId: DOCUMENT_ID,
    kind: 'puzzle',
    body: COUNTING_BODY,
    save: { saving: false, dirty: false, error: null },
    conflicted: false,
    metadataDisabled: false,
    disabled: false,
    preview: false,
    onChangeBody: fn(),
    onSaveAgain: fn(),
    onTogglePreview: fn(),
    onReturnToLibrary: fn(),
  },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Editing a saved draft: details, the game's editor, undo, playtest, publish. */
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

/** An edit is waiting to be saved. */
export const Unsaved: Story = {
  args: { save: { saving: false, dirty: true, error: null } },
};

/** The draft is saving; the builder's actions wait for it. */
export const Saving: Story = {
  args: {
    save: { saving: true, dirty: true, error: null },
    disabled: true,
  },
  render: (args) =>
    renderWith(args, () => ({
      history: <StoryDraftHistory disabled />,
      playtest: <StoryPlaytest disabled />,
      publication: publication({ disabled: true }),
    })),
};

const SAVE_FAILED = {
  save: {
    saving: false,
    dirty: true,
    error: 'The draft could not be saved. Try saving again.',
  },
} as const;

/** The save failed: the edits stay on screen with a retry. */
export const SaveFailed: Story = { args: SAVE_FAILED };

/** Another device kept a different working copy: choose one first. */
export const Conflicted: Story = {
  args: { conflicted: true },
  render: (args) =>
    renderWith(args, () => ({ publication: publication({ disabled: true }) })),
};

/** The draft passed validation and a completed playtest proves it. */
export const Validated: Story = {
  render: (args) =>
    renderWith(args, () => ({
      publication: publication({ validation: 'valid', proven: true }),
    })),
};

/** Validation found problems; the check's own message says what to fix. */
export const ValidationFailed: Story = {
  render: (args) =>
    renderWith(args, () => ({
      publication: publication({
        validation: 'invalid',
        validationMessage: 'The target must be a number from 2 to 9.',
      }),
    })),
};

/** Published and waiting for the server's confirmation while online. */
export const PublishPending: Story = {
  render: (args) =>
    renderWith(args, () => ({
      publication: publication({
        validation: 'valid',
        proven: true,
        pending: 'online',
      }),
    })),
};

/** Published while offline: it waits for the connection, the draft is kept. */
export const PublishPendingOffline: Story = {
  render: (args) =>
    renderWith(args, () => ({
      publication: publication({
        validation: 'valid',
        proven: true,
        pending: 'offline',
      }),
    })),
};

/** The server refused the publication; the card says why until dismissed. */
export const PublishRefused: Story = {
  render: (args) =>
    renderWith(args, () => ({
      publication: publication({
        validation: 'valid',
        proven: true,
        refusal: (
          <RefusedChangeCard
            refusal={{
              mutationId: 'f00d0000-0000-4000-8000-000000000001',
              mutationName: 'publishPuzzleContent',
              code: 'validation_failed',
              message: 'The puzzle cannot be finished from its start.',
              meta: null,
            }}
            onDismiss={fn()}
          />
        ),
      }),
    })),
};

const renderPublished = (args: ContentAuthorScreenViewProps) =>
  renderWith(args, () => ({
    publication: publication({
      validation: 'valid',
      proven: true,
      published: true,
    }),
  }));

/** An edition is out: it can be viewed or withdrawn from discovery. */
export const Published: Story = { render: (args) => renderPublished(args) };

/** The author may draft but not publish; the denial replaces Publish. */
export const PublishDenied: Story = {
  render: (args) =>
    renderWith(args, () => ({
      publication: publication({
        publishDenial: {
          icon: KeyRoundIcon,
          title: 'Publishing needs a verified account',
          dataSet: { testid: 'permission-denial', reason: 'not_granted' },
        },
      }),
    })),
};

/**
 * A pack: its puzzles in order, each with its tools, published puzzles to
 * add and a new one to create, instead of a game editor; no playtest.
 */
export const PackBuilder: Story = {
  args: {
    kind: 'pack',
    body: {
      ...COUNTING_BODY,
      title: 'Weekend counts',
      description: 'Three counts that get harder.',
      difficulty: '',
    },
  },
  render: (args) =>
    renderWith(args, () => ({
      stage: <StoryPackEditor />,
      publication: publication({ kind: 'pack' }),
      keptCopies: (
        <StoryKeptCopies current="Weekend counts" earlier="Weekend puzzles" />
      ),
    })),
};

/** Previewing the draft as a player sees it. */
export const Preview: Story = {
  args: { preview: true },
  render: (args) =>
    renderWith(args, () => ({
      stage: <StoryCountingPlayer state="0 of 7" disabled />,
    })),
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

/** Withdrawing asks first, in a destructive confirm. */
export const ConfirmWithdraw: Story = {
  render: (args) => renderPublished(args),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-withdraw'));
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByText('Withdraw this publication?')
    ).toBeVisible();
  },
};
