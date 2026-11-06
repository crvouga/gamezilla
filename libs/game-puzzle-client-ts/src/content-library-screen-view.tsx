import type {
  ContentKind,
  ContentRevision,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { PreviewCardGrid } from '@pkgs/ui-root-client-ts/preview-card-grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Tabs } from '@pkgs/ui-root-client-ts/tabs';
import { For, type JSX, Match, Show, Switch, untrack } from 'solid-js';
import {
  ContentDifficultyChip,
  ContentKindChip,
  ContentRowCaption,
  ContentStatusChip,
} from './content-chips';
import {
  type ContentAttemptList,
  ContentAttemptSection,
} from './content-library-attempts';
import {
  ContentLibraryCard,
  type ContentLibraryProgress,
  ContentProgressLine,
} from './content-library-card';
import { ContentMoreToPlay, continuePicks } from './content-library-picks';
import { ContentLoadMore } from './content-load-more';

/**
 * A puzzle definition a row's thumbnail draws (a pack's: its first
 * puzzle's); absent when there is nothing to draw yet.
 */
type ContentPreviewSource = {
  readonly preview?: string | undefined;
};

/** A shipped starter pack or a published puzzle or pack, as listed. */
export type ContentLibraryEdition = Pick<
  ContentRevision,
  'id' | 'document_id' | 'kind' | 'title' | 'description' | 'difficulty'
> &
  ContentPreviewSource & {
    /** A pack's puzzles the person has solved; absent for a puzzle. */
    readonly progress?: ContentLibraryProgress | undefined;
  };

/** One of the person's own drafts or publications. */
export type ContentLibraryDraft = ContentPreviewSource & {
  /** The document id. */
  readonly id: string;
  readonly kind: ContentKind;
  /** The working copy's title; empty shows "Untitled draft". */
  readonly title: string;
  readonly status: 'draft' | 'published' | 'withdrawn';
};

/** A saved attempt or private playtest, with the title of what it plays. */
export type ContentLibraryAttempt = ContentPreviewSource & {
  readonly id: string;
  /** Empty when the source has not reached this device. */
  readonly title: string;
  readonly completed: boolean;
  /** The difficulty its author gave the puzzle; empty when none. */
  readonly difficulty?: string | undefined;
  /** The pack it was started in, and how much of that pack is solved. */
  readonly pack?:
    | (ContentLibraryProgress & { readonly title: string })
    | undefined;
};

/** Which lists have a further page to load. */
export type ContentLibraryMore = {
  readonly owned: boolean;
  readonly attempts: boolean;
  readonly published: boolean;
};

export type ContentLibraryScreenViewProps = {
  /** `loading` until the stored library is read. */
  readonly status: 'loading' | 'ready';
  /** The game's name. */
  readonly title: string;
  /** Create-a-draft controls (or their denial). */
  readonly createControls?: JSX.Element;
  readonly bundledPacks: readonly ContentLibraryEdition[];
  /** Set when the person may not read their own content. */
  readonly personalDenial?: DenialView | undefined;
  readonly drafts: readonly ContentLibraryDraft[];
  readonly attempts: readonly ContentLibraryAttempt[];
  readonly playtests: readonly ContentLibraryAttempt[];
  readonly published: readonly ContentLibraryEdition[];
  readonly more: ContentLibraryMore;
  /**
   * The game's board preview for a puzzle definition, drawn small at the
   * start of each row; without it a row shows what kind of thing it is.
   */
  readonly renderPreview?: ((definition: string) => JSX.Element) | undefined;
  readonly onOpenEdition: (revisionId: string) => void;
  readonly onOpenDraft: (documentId: string) => void;
  readonly onOpenAttempt: (attemptId: string) => void;
  readonly onMoreOwned: () => void;
  readonly onMoreAttempts: () => void;
  readonly onMorePublished: () => void;
};

type View = ContentLibraryScreenViewProps;

function PublishedContent(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const ids = () => props.view.published.map((entry) => entry.id);
  return (
    <>
      <Show
        when={ids().length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title={t`No published puzzles loaded`}
            body={t`Create a private draft, or come back for new puzzles and packs.`}
          />
        }
      >
        <PreviewCardGrid title={<Trans>Published puzzles and packs</Trans>}>
          <For each={ids()}>
            {(id) => {
              const entry = () =>
                props.view.published.find((revision) => revision.id === id);
              return (
                <ContentLibraryCard
                  kind={entry()?.kind ?? 'puzzle'}
                  title={entry()?.title ?? ''}
                  preview={entry()?.preview}
                  renderPreview={props.view.renderPreview}
                  caption={
                    <ContentRowCaption description={entry()?.description}>
                      <ContentKindChip kind={entry()?.kind ?? 'puzzle'} />
                      <Show when={entry()?.difficulty}>
                        {(difficulty) => (
                          <ContentDifficultyChip difficulty={difficulty()} />
                        )}
                      </Show>
                    </ContentRowCaption>
                  }
                  meta={editionProgress(entry()?.progress)}
                  onOpen={() => props.view.onOpenEdition(id)}
                  testid={`content-published-${id}`}
                />
              );
            }}
          </For>
        </PreviewCardGrid>
      </Show>
      <ContentLoadMore
        testId="content-more-published"
        page={{
          hasMore: () => props.view.more.published,
          more: () => props.view.onMorePublished(),
        }}
        label={t`Load more published puzzles and packs`}
      />
    </>
  );
}

/** A pack's solved count, when it has puzzles to solve; else nothing. */
function editionProgress(
  progress: ContentLibraryProgress | undefined
): JSX.Element | undefined {
  return progress === undefined || progress.total === 0 ? undefined : (
    <ContentProgressLine progress={progress} />
  );
}

/** Packs the game ships: available to everyone, with or without a connection. */
function BundledPacks(props: { view: View }): JSX.Element {
  return (
    <Show when={props.view.bundledPacks.length > 0}>
      <PreviewCardGrid title={<Trans>Starter packs</Trans>}>
        <For each={props.view.bundledPacks}>
          {(pack) => (
            <ContentLibraryCard
              kind={pack.kind}
              title={pack.title}
              preview={pack.preview}
              renderPreview={props.view.renderPreview}
              caption={
                <ContentRowCaption description={pack.description}>
                  <ContentKindChip kind={pack.kind} />
                </ContentRowCaption>
              }
              meta={editionProgress(pack.progress)}
              onOpen={() => props.view.onOpenEdition(pack.id)}
              testid={`content-bundled-${pack.document_id}`}
            />
          )}
        </For>
      </PreviewCardGrid>
    </Show>
  );
}

function OwnedContent(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const ids = () => props.view.drafts.map((draft) => draft.id);
  return (
    <>
      <Show when={ids().length > 0}>
        <PreviewCardGrid title={<Trans>Your drafts and publications</Trans>}>
          <For each={ids()}>
            {(id) => {
              const draft = () =>
                props.view.drafts.find((entry) => entry.id === id);
              return (
                <ContentLibraryCard
                  kind={draft()?.kind ?? 'puzzle'}
                  title={(draft()?.title ?? '') || t`Untitled draft`}
                  preview={draft()?.preview}
                  renderPreview={props.view.renderPreview}
                  caption={
                    <ContentRowCaption>
                      <ContentStatusChip status={draft()?.status ?? 'draft'} />
                      <ContentKindChip kind={draft()?.kind ?? 'puzzle'} />
                    </ContentRowCaption>
                  }
                  onOpen={() => props.view.onOpenDraft(id)}
                  testid={`content-draft-${id}`}
                />
              );
            }}
          </For>
        </PreviewCardGrid>
      </Show>
      <ContentLoadMore
        page={{
          hasMore: () => props.view.more.owned,
          more: () => props.view.onMoreOwned(),
        }}
        label={t`Load more of your drafts and publications`}
      />
    </>
  );
}

/** Earlier attempts and playtests share one page of the person's play. */
function MoreAttempts(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <ContentLoadMore
      page={{
        hasMore: () => props.view.more.attempts,
        more: () => props.view.onMoreAttempts(),
      }}
      label={t`Load earlier attempts`}
    />
  );
}

type LibraryTab = 'browse' | 'continue' | 'mine';

/** Which of the person's attempts are finished or not. */
function attemptsDone(view: View, completed: boolean) {
  return view.attempts.filter((attempt) => attempt.completed === completed);
}

/** One list of the person's attempts or playtests, as compact rows. */
function AttemptList(props: {
  view: View;
  list: ContentAttemptList;
  attempts: readonly ContentLibraryAttempt[];
}): JSX.Element {
  return (
    <ContentAttemptSection
      list={props.list}
      attempts={props.attempts}
      renderPreview={props.view.renderPreview}
      onOpenAttempt={props.view.onOpenAttempt}
    />
  );
}

/**
 * Everyone's puzzles: the shipped starter packs, then everything
 * published, then the ones the person has solved.
 */
function BrowsePanel(props: { view: View }): JSX.Element {
  return (
    <StackVertical
      gap="lg"
      paddingTop="lg"
      dataSet={{ testid: 'content-library-browse' }}
    >
      <BundledPacks view={props.view} />
      <PublishedContent view={props.view} />
      <AttemptList
        view={props.view}
        list="finished"
        attempts={attemptsDone(props.view, true)}
      />
    </StackVertical>
  );
}

/**
 * Only what the person left unfinished, to pick up where they left it;
 * with little of it, Browse's next puzzles and packs follow under "More to
 * play".
 */
function ContinuePanel(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const unfinished = () => attemptsDone(props.view, false);
  return (
    <StackVertical
      gap="lg"
      paddingTop="lg"
      dataSet={{ testid: 'content-library-continue' }}
    >
      <Show
        when={unfinished().length > 0 || props.view.more.attempts}
        fallback={
          <EmptyState
            variant="compact"
            title={t`Nothing to continue yet`}
            body={t`Puzzles you start from Browse wait here, at the move you left them.`}
          />
        }
      >
        <AttemptList
          view={props.view}
          list="unfinished"
          attempts={unfinished()}
        />
        <MoreAttempts view={props.view} />
      </Show>
      <ContentMoreToPlay
        picks={continuePicks(
          [...props.view.bundledPacks, ...props.view.published],
          unfinished().map((attempt) => attempt.title)
        )}
        renderPreview={props.view.renderPreview}
        onOpenEdition={props.view.onOpenEdition}
      />
    </StackVertical>
  );
}

/** What the person builds: their drafts and publications, then playtests. */
function MinePanel(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical
      gap="lg"
      paddingTop="lg"
      dataSet={{ testid: 'content-library-mine' }}
    >
      <Show
        when={props.view.personalDenial}
        fallback={
          <Show
            when={
              props.view.drafts.length > 0 ||
              props.view.more.owned ||
              props.view.playtests.length > 0
            }
            fallback={
              <EmptyState
                variant="compact"
                title={t`Nothing built yet`}
                body={t`Create a puzzle or a pack. Drafts stay private until you publish them.`}
              />
            }
          >
            <OwnedContent view={props.view} />
          </Show>
        }
      >
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
      <AttemptList
        view={props.view}
        list="playtest"
        attempts={props.view.playtests}
      />
    </StackVertical>
  );
}

/** Where a library opens: what the person left unfinished, else browsing. */
function firstTab(view: View): LibraryTab {
  return view.attempts.some((attempt) => !attempt.completed)
    ? 'continue'
    : 'browse';
}

/**
 * Continue, Browse and My creations, one at a time: picking up where the
 * person left off comes first. Every panel stays
 * rendered so its loaded pages keep their place across switches.
 */
function LibraryTabs(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const unfinished = () =>
    props.view.attempts.filter((attempt) => !attempt.completed).length;
  return (
    <Tabs<LibraryTab>
      aria-label={t`Puzzles`}
      testId="content-library-tab"
      keepMounted
      defaultValue={untrack(() => firstTab(props.view))}
      items={[
        {
          value: 'continue',
          label: t`Continue`,
          badge: unfinished() > 0 ? unfinished() : undefined,
        },
        { value: 'browse', label: t`Browse` },
        { value: 'mine', label: t`My creations` },
      ]}
    >
      {(tab) => (
        <Switch>
          <Match when={tab === 'browse'}>
            <BrowsePanel view={props.view} />
          </Match>
          <Match when={tab === 'continue'}>
            <ContinuePanel view={props.view} />
          </Match>
          <Match when={tab === 'mine'}>
            <MinePanel view={props.view} />
          </Match>
        </Switch>
      )}
    </Tabs>
  );
}

/**
 * A game's puzzle library, presentational: creating a puzzle or a pack as
 * the screen's own actions at its title, then three tabs, one shown at a
 * time: Continue (only what is left unfinished, as compact rows), Browse
 * (the shipped starter packs, everything published, then what the person
 * solved) and My creations (drafts and publications, then the playtests of
 * their drafts); each list paged. It opens on
 * Continue when something is unfinished, else on Browse. Data arrives as
 * props; `ContentLibraryScreen` reads it from the synced library.
 */
export function ContentLibraryScreenView(
  props: ContentLibraryScreenViewProps
): JSX.Element {
  return (
    <Show when={props.status === 'ready'} fallback={<LoadingState />}>
      <EmbeddedScreen
        screenId="puzzle-content-library"
        width="full"
        title={props.title}
        subtitle={
          <Trans>
            Play puzzles, pick up where you left off, or make your own.
          </Trans>
        }
        actions={props.createControls}
      >
        <LibraryTabs view={props} />
      </EmbeddedScreen>
    </Show>
  );
}
