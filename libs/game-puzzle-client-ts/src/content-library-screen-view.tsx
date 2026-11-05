import type { ContentRevision } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import { ContentLoadMore } from './content-load-more';

/** A shipped starter pack or a published puzzle or pack, as listed. */
export type ContentLibraryEdition = Pick<
  ContentRevision,
  'id' | 'document_id' | 'kind' | 'title' | 'description' | 'difficulty'
>;

/** One of the person's own drafts or publications. */
export type ContentLibraryDraft = {
  /** The document id. */
  readonly id: string;
  /** The working copy's title; empty shows "Untitled draft". */
  readonly title: string;
  readonly status: 'draft' | 'published' | 'withdrawn';
};

/** A saved attempt or private playtest, with the title of what it plays. */
export type ContentLibraryAttempt = {
  readonly id: string;
  /** Empty when the source has not reached this device. */
  readonly title: string;
  readonly completed: boolean;
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
            body={t`Create a private draft above, or come back for new puzzles and packs.`}
          />
        }
      >
        <MenuSection title={<Trans>Published puzzles and packs</Trans>}>
          <For each={ids()}>
            {(id) => {
              const entry = () =>
                props.view.published.find((revision) => revision.id === id);
              return (
                <MenuRow
                  title={entry()?.title}
                  caption={entry()?.description}
                  value={
                    entry()?.kind === 'pack'
                      ? t`Pack`
                      : (entry()?.difficulty ?? '') || t`Puzzle`
                  }
                  onClick={() => props.view.onOpenEdition(id)}
                  dataSet={{ testid: `content-published-${id}` }}
                />
              );
            }}
          </For>
        </MenuSection>
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

/** Packs the game ships: available to everyone, with or without a connection. */
function BundledPacks(props: { view: View }): JSX.Element {
  return (
    <Show when={props.view.bundledPacks.length > 0}>
      <MenuSection title={<Trans>Starter packs</Trans>}>
        <For each={props.view.bundledPacks}>
          {(pack) => (
            <MenuRow
              title={pack.title}
              caption={pack.description}
              onClick={() => props.view.onOpenEdition(pack.id)}
              dataSet={{ testid: `content-bundled-${pack.document_id}` }}
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}

function OwnedContent(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const ids = () => props.view.drafts.map((draft) => draft.id);
  const statusLabel = (status: ContentLibraryDraft['status'] | undefined) =>
    status === 'published'
      ? t`Published`
      : status === 'withdrawn'
        ? t`Withdrawn`
        : t`Draft`;
  return (
    <>
      <Show when={ids().length > 0}>
        <MenuSection title={<Trans>Your drafts and publications</Trans>}>
          <For each={ids()}>
            {(id) => {
              const draft = () =>
                props.view.drafts.find((entry) => entry.id === id);
              return (
                <MenuRow
                  title={(draft()?.title ?? '') || t`Untitled draft`}
                  value={statusLabel(draft()?.status)}
                  onClick={() => props.view.onOpenDraft(id)}
                  dataSet={{ testid: `content-draft-${id}` }}
                />
              );
            }}
          </For>
        </MenuSection>
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

function SavedAttempts(props: {
  mode: 'ordinary' | 'playtest';
  attempts: readonly ContentLibraryAttempt[];
  onOpenAttempt: (attemptId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const ordinary = () => props.mode === 'ordinary';
  return (
    <Show when={props.attempts.length > 0}>
      <MenuSection
        title={
          ordinary() ? (
            <Trans>Continue playing</Trans>
          ) : (
            <Trans>Your private playtests</Trans>
          )
        }
        footer={
          ordinary() ? (
            <Trans>
              Each attempt keeps your progress at the edition you started.
            </Trans>
          ) : (
            <Trans>Playtests change no personal or pack progress.</Trans>
          )
        }
      >
        <For each={props.attempts.map((attempt) => attempt.id)}>
          {(id) => {
            const attempt = () =>
              props.attempts.find((entry) => entry.id === id);
            return (
              <MenuRow
                title={(attempt()?.title ?? '') || t`Saved puzzle`}
                trailing={
                  <Badge
                    label={
                      attempt()?.completed === true
                        ? t`Completed`
                        : ordinary()
                          ? t`In progress`
                          : t`Playtest`
                    }
                    intent="neutral"
                  />
                }
                onClick={() => props.onOpenAttempt(id)}
                dataSet={{ testid: `content-attempt-${id}` }}
              />
            );
          }}
        </For>
      </MenuSection>
    </Show>
  );
}

/** The person's attempts: where they left off first, then their playtests. */
function Attempts(props: {
  view: View;
  mode: 'ordinary' | 'playtest';
}): JSX.Element {
  return (
    <SavedAttempts
      mode={props.mode}
      attempts={
        props.mode === 'ordinary' ? props.view.attempts : props.view.playtests
      }
      onOpenAttempt={props.view.onOpenAttempt}
    />
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

/**
 * Playing: the person's attempts to continue, the shipped starter packs,
 * then everything published.
 */
function PlayColumn(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-library-play' }}>
      <Attempts view={props.view} mode="ordinary" />
      <MoreAttempts view={props.view} />
      <BundledPacks view={props.view} />
      <PublishedContent view={props.view} />
    </StackVertical>
  );
}

/** Building: creating a draft, the person's own drafts, their playtests. */
function CreateColumn(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-library-create' }}>
      {props.view.createControls}
      <Show
        when={props.view.personalDenial}
        fallback={<OwnedContent view={props.view} />}
      >
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
      <Attempts view={props.view} mode="playtest" />
    </StackVertical>
  );
}

/**
 * A game's puzzle library, presentational, in two columns on a wide screen
 * (one after the other on a phone, playing first): playing — saved attempts
 * to continue, the shipped starter packs, the published puzzles and packs
 * — and building — create a draft, the person's own drafts and their
 * playtests; each list paged. Data arrives as props;
 * `ContentLibraryScreen` reads it from the synced library.
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
            Play published puzzles, continue your attempts, or build something
            of your own.
          </Trans>
        }
      >
        <Grid columns={{ base: 1, lg: 2 }} gap="xl" align="start">
          <PlayColumn view={props} />
          <CreateColumn view={props} />
        </Grid>
      </EmbeddedScreen>
    </Show>
  );
}
