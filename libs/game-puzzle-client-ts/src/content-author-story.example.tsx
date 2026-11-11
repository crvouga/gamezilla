/**
 * Story-only: the shared builder on a counting puzzle's draft, as each of
 * its small screens' stories starts from it, with stand-ins for the smart
 * widgets it takes as slots. Production never imports this module.
 */
import { RefusedChangeCard } from '@libs/app-env-client-ts/refused-change-notice';
import { createSignal, type JSX } from 'solid-js';
import { fn } from 'storybook/test';
import {
  ContentAuthorScreenView,
  type ContentAuthorScreenViewProps,
} from './content-author-screen-view';
import { contentBuilderStanding } from './content-builder-standing';
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
  StoryPlaytest,
} from './content-story.example';
import { ContentWithdrawConfirm } from './content-withdraw';

type Publication = Partial<ContentPublicationControlsViewProps>;

type Slots = Pick<
  ContentAuthorScreenViewProps,
  'history' | 'stage' | 'preview' | 'keptCopies'
>;

/** What one story changes of the builder's stand-ins. */
export type AuthorStoryOptions = {
  /** Where checking and publishing stands; the hub's row follows it. */
  readonly publication?: Publication | undefined;
  /** Stand-ins replaced for this state, made when the view reads them. */
  readonly slots?: (() => Partial<Slots>) | undefined;
  /** The server refused the last publication. */
  readonly refused?: boolean | undefined;
};

/** The refusal card the shell keeps on every place until dismissed. */
function StoryRefusal(): JSX.Element {
  return (
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
  );
}

/** The publish screen's facts: a draft with nothing in flight, then `overrides`. */
function publicationProps(
  kind: ContentAuthorScreenViewProps['kind'],
  overrides: Publication
) {
  return {
    copyState: { kind: 'draft' },
    kind,
    validation: 'unchecked',
    validationMessage: '',
    proven: false,
    pending: null,
    published: false,
    disabled: false,
    onValidate: fn(async () => undefined),
    onPublish: fn(async () => undefined),
    onViewPublication: fn(),
    onWithdraw: fn(),
    ...overrides,
  } satisfies ContentPublicationControlsViewProps;
}

/**
 * The builder with fresh stand-ins per mount. Its hub's standing and its
 * publish screen read the same publication facts, as in production, and
 * withdrawing opens the shell's own confirm.
 */
export function renderAuthorStory(
  args: ContentAuthorScreenViewProps,
  options: AuthorStoryOptions = {}
): JSX.Element {
  const [withdrawing, setWithdrawing] = createSignal(false);
  const publication = publicationProps(args.kind, {
    disabled: args.disabled,
    ...options.publication,
  });
  let chosen: Partial<Slots> | undefined;
  const slot = <K extends keyof Slots>(key: K): Partial<Slots>[K] => {
    chosen ??= options.slots?.() ?? {};
    return chosen[key];
  };
  return (
    <ContentAuthorScreenView
      {...args}
      standing={contentBuilderStanding({
        ...publication,
        waitingOn: publication.waitingOn ?? [],
        playable: args.playable,
      })}
      history={slot('history') ?? <StoryDraftHistory />}
      stage={slot('stage') ?? <StoryCountingEditor target="7" />}
      preview={slot('preview') ?? <StoryCountingPlayer state="count:0" disabled />}
      keptCopies={slot('keptCopies') ?? <StoryKeptCopies />}
      refusal={options.refused === true ? <StoryRefusal /> : undefined}
      publication={
        <ContentPublicationControlsView
          {...publication}
          before={
            args.kind === 'pack'
              ? undefined
              : (next) => (
                  <StoryPlaytest disabled={args.disabled} next={next()} />
                )
          }
          onWithdraw={() => setWithdrawing(true)}
        />
      }
      confirms={
        <ContentWithdrawConfirm
          visible={withdrawing()}
          onClose={() => setWithdrawing(false)}
          onWithdraw={fn(async () => undefined)}
        />
      }
    />
  );
}

/** A counting puzzle's saved draft, opened on the builder's hub. */
export const AUTHOR_STORY_ARGS = {
  status: 'ready',
  documentId: '5d0c1a00-0000-4000-8000-0000000000a1',
  draftId: '5d0c1a00-0000-4000-8000-0000000000a2',
  kind: 'puzzle',
  body: COUNTING_BODY,
  save: { saving: false, dirty: false, error: null },
  conflicted: false,
  metadataDisabled: false,
  disabled: false,
  place: { screen: 'builder' },
  onOpen: fn(),
  standing: { kind: 'playtest' },
  playable: true,
  previewable: true,
  copies: 2,
  onChangeBody: fn(),
  onSaveAgain: fn(),
  onOpenWaiting: fn(),
  onViewPublication: fn(),
  onReturnToLibrary: fn(),
} satisfies ContentAuthorScreenViewProps;

/** A pack draft of three counting puzzles. */
export const AUTHOR_STORY_PACK = {
  kind: 'pack',
  puzzles: 3,
  body: {
    ...COUNTING_BODY,
    title: 'Weekend counts',
    description: 'Three puzzles that get harder.',
    difficulty: '',
    definition: '{"items":[]}',
  },
} satisfies Partial<ContentAuthorScreenViewProps>;

/** What a builder story's controls leave out: its data and slots. */
export const AUTHOR_STORY_PARAMETERS = {
  appRouter: true,
  controls: {
    exclude: [
      'denial',
      'body',
      'save',
      'place',
      'standing',
      'history',
      'publication',
      'stage',
      'preview',
      'keptCopies',
      'refusal',
      'confirms',
    ],
  },
} as const;

/** A check that passed with a finished playtest: ready to publish. */
export const PUBLICATION_READY = {
  validation: 'valid',
  proven: true,
} satisfies Publication;

/** The current copy is published. */
export const PUBLICATION_PUBLISHED = {
  ...PUBLICATION_READY,
  published: true,
  copyState: { kind: 'edition', current: true },
} satisfies Publication;
