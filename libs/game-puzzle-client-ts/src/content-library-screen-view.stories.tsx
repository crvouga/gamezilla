import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  createJSXDecorator,
  type Meta,
  type StoryObj,
} from 'storybook-solidjs-vite';
import { ContentConnectionStatusView } from './content-connection-status-view';
import { ContentCreateControlsView } from './content-create-controls-view';
import {
  type ContentLibraryEdition,
  ContentLibraryScreenView,
  type ContentLibraryScreenViewProps,
} from './content-library-screen-view';
import { StoryCountingPreview } from './content-story.example';

const BUNDLED: readonly ContentLibraryEdition[] = [
  {
    id: 'bundled-counting-starter-r1',
    document_id: 'bundled-counting-starter',
    kind: 'pack',
    title: 'Counting starter pack',
    description: 'Five short counts to learn the rules.',
    difficulty: '',
    preview: 'target:5',
    progress: { completed: 2, total: 5 },
  },
];

const COUNT_TO_SEVEN: ContentLibraryEdition = {
  id: '7c1e0a00-0000-4000-8000-000000000001',
  document_id: '7c1e0a00-0000-4000-8000-0000000000d1',
  kind: 'puzzle',
  title: 'Count to seven',
  description: 'Reach seven exactly, one or two steps at a time.',
  difficulty: 'Easy',
  preview: 'target:7',
};

const PUBLISHED: readonly ContentLibraryEdition[] = [
  COUNT_TO_SEVEN,
  {
    id: '7c1e0a00-0000-4000-8000-000000000002',
    document_id: '7c1e0a00-0000-4000-8000-0000000000d2',
    kind: 'puzzle',
    title: 'Thirteen without overshooting',
    description: '',
    difficulty: 'Medium',
    preview: 'target:13',
  },
  {
    id: '7c1e0a00-0000-4000-8000-000000000003',
    document_id: '7c1e0a00-0000-4000-8000-0000000000d3',
    kind: 'pack',
    title: 'Weekend counts',
    description: 'Three puzzles that get harder.',
    difficulty: '',
    preview: 'target:5',
    progress: { completed: 1, total: 3 },
  },
];

/** The create controls with nothing in flight. */
function createControls(denied = false) {
  return (
    <ContentCreateControlsView
      denial={
        denied
          ? {
              icon: KeyRoundIcon,
              title: 'Sign in to create puzzles',
              body: 'Your drafts are saved to your account.',
              action: { label: 'Sign in', onPress: fn() },
              dataSet: {
                testid: 'permission-denial',
                reason: 'requires_account',
              },
            }
          : undefined
      }
      canCreatePuzzle
      onCreate={fn(async () => 'draft-1')}
      onOpenDraft={fn()}
    />
  );
}

/** Renders the view with fresh create controls per mount. */
function renderWith(args: ContentLibraryScreenViewProps, denied = false) {
  return (
    <ContentLibraryScreenView
      {...args}
      createControls={createControls(denied)}
    />
  );
}

/** The connection status that sits above the library in the app. */
const withConnection = (status: {
  online: boolean;
  lastError: string | null;
}) =>
  createJSXDecorator((Story) => (
    <>
      <ContentConnectionStatusView
        loading={false}
        online={status.online}
        lastError={status.lastError}
        onReconnect={fn()}
      />
      <Story />
    </>
  ));

const meta = {
  id: 'screens-puzzles-content-library',
  title: 'Screens/Puzzles/Content library',
  component: ContentLibraryScreenView,
  tags: ['autodocs'],
  render: (args) => renderWith(args),
  parameters: {
    appRouter: true,
    controls: {
      exclude: [
        'createControls',
        'bundledPacks',
        'personalDenial',
        'drafts',
        'attempts',
        'playtests',
        'published',
        'more',
        'renderPreview',
      ],
    },
  },
  args: {
    status: 'ready',
    title: 'Counting',
    bundledPacks: BUNDLED,
    drafts: [
      {
        id: 'doc-draft-1',
        kind: 'puzzle',
        title: 'Count to eleven',
        status: 'draft',
        preview: 'target:11',
      },
      {
        id: 'doc-draft-2',
        kind: 'puzzle',
        title: 'Five in two steps',
        status: 'draft',
        preview: 'target:5',
      },
      {
        id: 'doc-draft-3',
        kind: 'puzzle',
        title: 'Count to seven',
        status: 'published',
        preview: 'target:7',
      },
      {
        id: 'doc-draft-4',
        kind: 'pack',
        title: 'Old count',
        status: 'withdrawn',
        preview: 'target:3',
      },
    ],
    attempts: [
      {
        id: 'attempt-1',
        title: 'Count to seven',
        completed: false,
        difficulty: 'Easy',
        pack: { title: 'Weekend counts', completed: 1, total: 3 },
        preview: 'target:7',
      },
      {
        id: 'attempt-3',
        title: 'Thirteen without overshooting',
        completed: false,
        difficulty: 'Medium',
        preview: 'target:13',
      },
      {
        id: 'attempt-2',
        title: 'Count to five',
        completed: true,
        difficulty: 'Easy',
        pack: { title: 'Weekend counts', completed: 1, total: 3 },
        preview: 'target:5',
      },
    ],
    playtests: [
      {
        id: 'attempt-4',
        title: 'Count to eleven',
        completed: false,
        preview: 'target:11',
      },
    ],
    renderPreview: (definition: string) => (
      <StoryCountingPreview definition={definition} />
    ),
    published: PUBLISHED,
    more: { owned: false, attempts: false, published: true },
    onOpenEdition: fn(),
    onOpenDraft: fn(),
    onOpenAttempt: fn(),
    onMoreOwned: fn(),
    onMoreAttempts: fn(),
    onMorePublished: fn(),
  },
} satisfies Meta<typeof ContentLibraryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Everything a returning author sees: packs, drafts, attempts, publications. */
export const Populated: Story = {};

/** The stored library has not been read yet: one activity indicator. */
export const Loading: Story = { args: { status: 'loading' } };

/** A first visit: only the shipped starter pack, nothing published loaded. */
export const Empty: Story = {
  args: {
    drafts: [],
    attempts: [],
    playtests: [],
    published: [],
    more: { owned: false, attempts: false, published: false },
  },
};

/** Every list has a further page: each shows its own load-more button. */
export const MorePages: Story = {
  args: { more: { owned: true, attempts: true, published: true } },
};

/** Syncing failed while online: the library stays usable, reconnect retries. */
export const Failed: Story = {
  decorators: [
    withConnection({
      online: true,
      lastError: 'The server did not answer. Your changes are kept.',
    }),
  ],
};

/** Offline: available puzzles and saved work stay on the device. */
export const Offline: Story = {
  decorators: [withConnection({ online: false, lastError: null })],
};

/** Someone signed out: creating and their own content are behind sign-in. */
export const Denied: Story = {
  render: (args) => renderWith(args, true),
  args: {
    drafts: [],
    attempts: [],
    playtests: [],
    personalDenial: {
      icon: KeyRoundIcon,
      title: 'Sign in to see your drafts',
      body: 'Your drafts and publications are kept with your account.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  },
};

/** Long titles and descriptions wrap or truncate without breaking rows. */
export const LongContent: Story = {
  args: {
    title: 'A counting game with a deliberately long localized name',
    published: [
      {
        ...COUNT_TO_SEVEN,
        title:
          'Count all the way to ninety-nine without overshooting even once',
        description:
          'A long description that keeps going to show how the caption behaves when an author writes a paragraph instead of a sentence.',
        difficulty: 'Very difficult',
      },
    ],
  },
};

/** Pressing a published puzzle opens its edition. */
export const OpenPublished: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(`content-published-${COUNT_TO_SEVEN.id}`)
    );
    await expect(args.onOpenEdition).toHaveBeenCalledWith(COUNT_TO_SEVEN.id);
  },
};
