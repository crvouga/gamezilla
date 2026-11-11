import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { PreviewCardGrid } from '@pkgs/ui-root-client-ts/preview-card-grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
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
import type {
  ContentLibraryAttempt,
  ContentLibraryScreenViewProps,
} from './content-library-screen-view';
import { ContentLoadMore } from './content-load-more';

type View = ContentLibraryScreenViewProps;

/** A pack's solved count, when it has puzzles to solve; else nothing. */
function editionProgress(
  progress: ContentLibraryProgress | undefined
): JSX.Element | undefined {
  return progress === undefined || progress.total === 0 ? undefined : (
    <ContentProgressLine progress={progress} />
  );
}

/** Everything published, as cards. */
function PublishedCards(props: { view: View }): JSX.Element {
  const ids = () => props.view.published.map((entry) => entry.id);
  return (
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
  );
}

/**
 * `browse`: everything published, a page at a time; nothing loaded says
 * so, and what to do meanwhile.
 */
export function ContentLibraryBrowseView(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-library-browse' }}>
      <Show
        when={props.view.published.length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title={t`No published puzzles loaded`}
            body={t`Play a starter pack, create a private draft, or come back for new puzzles and packs.`}
            action={{
              label: t`Back to puzzles`,
              onClick: () => props.view.onOpen({ screen: 'library' }),
            }}
          />
        }
      >
        <PublishedCards view={props.view} />
      </Show>
      <ContentLoadMore
        testId="content-more-published"
        page={{
          hasMore: () => props.view.more.published,
          more: () => props.view.onMorePublished(),
        }}
        label={t`Load more published puzzles and packs`}
      />
    </StackVertical>
  );
}

/** The person's own drafts and publications, as cards. */
function OwnedCards(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const ids = () => props.view.drafts.map((draft) => draft.id);
  return (
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
  );
}

/** What the person has built, or that nothing is built yet. */
function OwnedList(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show
        when={props.view.drafts.length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title={t`Nothing built yet`}
            body={t`Create a puzzle or a pack. Drafts stay private until you publish them.`}
            action={{
              label: t`Back to puzzles`,
              onClick: () => props.view.onOpen({ screen: 'library' }),
            }}
          />
        }
      >
        <OwnedCards view={props.view} />
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

/**
 * `mine`: the person's drafts and publications, a page at a time — or why
 * they may not read them, or that nothing is built yet.
 */
export function ContentLibraryMineView(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-library-mine' }}>
      <Show
        when={props.view.personalDenial}
        fallback={<OwnedList view={props.view} />}
      >
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
    </StackVertical>
  );
}

/**
 * One list of the person's saved play, a page of it at a time: the page
 * holds every kind of attempt, so each of these lists loads earlier ones.
 */
function AttemptPage(props: {
  view: View;
  list: ContentAttemptList;
  attempts: readonly ContentLibraryAttempt[];
  empty: JSX.Element;
  testid: string;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg" dataSet={{ testid: props.testid }}>
      <Show when={props.attempts.length > 0} fallback={props.empty}>
        <ContentAttemptSection
          list={props.list}
          attempts={props.attempts}
          renderPreview={props.view.renderPreview}
          onOpenAttempt={props.view.onOpenAttempt}
        />
      </Show>
      <ContentLoadMore
        page={{
          hasMore: () => props.view.more.attempts,
          more: () => props.view.onMoreAttempts(),
        }}
        label={t`Load earlier attempts`}
      />
    </StackVertical>
  );
}

/** Which of the person's attempts are finished or not. */
function attemptsDone(view: View, completed: boolean) {
  return view.attempts.filter((attempt) => attempt.completed === completed);
}

/**
 * `continue`: only what the person left unfinished, each row opening at
 * the move they left it; nothing started leads to Browse.
 */
export function ContentLibraryContinueView(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <AttemptPage
      view={props.view}
      list="unfinished"
      attempts={attemptsDone(props.view, false)}
      testid="content-library-continue"
      empty={
        <EmptyState
          variant="compact"
          title={t`Nothing to continue yet`}
          body={t`Puzzles you start from Browse wait here, at the move you left them.`}
          action={{
            label: t`Browse puzzles`,
            onClick: () => props.view.onOpen({ screen: 'browse' }),
          }}
        />
      }
    />
  );
}

/** `solved`: the puzzles the person finished, each to play again. */
export function ContentLibrarySolvedView(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <AttemptPage
      view={props.view}
      list="finished"
      attempts={attemptsDone(props.view, true)}
      testid="content-library-solved"
      empty={
        <EmptyState
          variant="compact"
          title={t`Nothing solved here yet`}
          body={t`Puzzles you finish are listed here, with the pack they belong to.`}
          action={{
            label: t`Browse puzzles`,
            onClick: () => props.view.onOpen({ screen: 'browse' }),
          }}
        />
      }
    />
  );
}

/** `playtests`: the practice runs of the person's own drafts. */
export function ContentLibraryPlaytestsView(props: {
  view: View;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <AttemptPage
      view={props.view}
      list="playtest"
      attempts={props.view.playtests}
      testid="content-library-playtests"
      empty={
        <EmptyState
          variant="compact"
          title={t`No playtests yet`}
          body={t`Start a playtest from a draft's Check and publish step. Practice runs don't count toward your progress.`}
          action={{
            label: t`My creations`,
            onClick: () => props.view.onOpen({ screen: 'mine' }),
          }}
        />
      }
    />
  );
}
