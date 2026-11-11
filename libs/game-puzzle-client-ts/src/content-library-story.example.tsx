/**
 * Story-only: the counting game's puzzle library as each of its small
 * screens' stories starts from it. Production never imports this module.
 */
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { ContentConnectionStatusView } from './content-connection-status-view';
import type {
  ContentLibraryEdition,
  ContentLibraryScreenViewProps,
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

/** A published puzzle the stories open and stretch. */
export const COUNT_TO_SEVEN: ContentLibraryEdition = {
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

/** What a signed-out person is told instead of their own content. */
export const SIGN_IN_DENIAL = {
  icon: KeyRoundIcon,
  title: 'Sign in to see your drafts',
  body: 'Your drafts and publications are kept with your account.',
  action: { label: 'Sign in', onPress: fn() },
  dataSet: { testid: 'permission-denial', reason: 'requires_account' },
} as const;

/** What a signed-out person is told instead of the create rows. */
export const CREATE_DENIAL = {
  icon: KeyRoundIcon,
  title: 'Sign in to create puzzles',
  body: 'Your drafts are saved to your account.',
  action: { label: 'Sign in', onPress: fn() },
  dataSet: { testid: 'permission-denial', reason: 'requires_account' },
} as const;

/** A returning author's library: packs, drafts, attempts, publications. */
export const LIBRARY_STORY_ARGS = {
  status: 'ready',
  place: { screen: 'library' },
  onOpen: fn(),
  title: 'Counting',
  create: { status: 'idle' },
  canCreatePuzzle: true,
  onCreate: fn(),
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
} satisfies ContentLibraryScreenViewProps;

/** A first visit: nothing started, built or published. */
export const LIBRARY_STORY_EMPTY = {
  drafts: [],
  attempts: [],
  playtests: [],
  published: [],
  more: { owned: false, attempts: false, published: false },
} satisfies Partial<ContentLibraryScreenViewProps>;

/** What a library story's controls leave out: its lists and slots. */
export const LIBRARY_STORY_PARAMETERS = {
  appRouter: true,
  controls: {
    exclude: [
      'place',
      'create',
      'createDenial',
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
} as const;

/** The connection status that sits above the library in the app. */
export const withLibraryConnection = (status: {
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
