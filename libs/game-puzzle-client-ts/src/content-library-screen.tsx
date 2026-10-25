import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { isBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import {
  discoverContent,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { ContentCreateControls } from './content-create-controls';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { ContentLoadMore } from './content-load-more';
import { ContentSavedAttempts } from './content-saved-attempts';
import { byContentId } from './use-content-pages';

function PublishedContent(): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const entries = createMemo(() =>
    discoverContent(
      {
        ...data.content(),
        documents: data
          .content()
          .documents.filter(
            (doc) =>
              doc.published_revision_id !== null && !isBundledContent(doc.id)
          )
          .toSorted(byContentId)
          .slice(0, data.pages.published.limit()),
      },
      game.id
    )
  );
  const ids = createMemo(() => entries().map((entry) => entry.id));
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
                entries().find((revision) => revision.id === id);
              return (
                <MenuRow
                  title={entry()?.title}
                  caption={entry()?.description}
                  value={
                    entry()?.kind === 'pack'
                      ? t`Pack`
                      : (entry()?.difficulty ?? '') || t`Puzzle`
                  }
                  onClick={() =>
                    game.open({
                      kind: 'edition',
                      revisionId: id,
                      packRevisionId: null,
                    })
                  }
                  dataSet={{ testid: `content-published-${id}` }}
                />
              );
            }}
          </For>
        </MenuSection>
      </Show>
      <ContentLoadMore
        testId="content-more-published"
        page={data.pages.published}
        label={t`Load more published puzzles and packs`}
      />
    </>
  );
}

/** Packs the game ships: available to everyone, with or without a connection. */
function BundledPacks(): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const packs = createMemo(() =>
    discoverContent(data.content(), game.id).filter(
      (edition) => edition.kind === 'pack' && isBundledContent(edition.id)
    )
  );
  return (
    <Show when={packs().length > 0}>
      <MenuSection title={<Trans>Starter packs</Trans>}>
        <For each={packs()}>
          {(pack) => (
            <MenuRow
              title={pack.title}
              caption={pack.description}
              onClick={() =>
                game.open({
                  kind: 'edition',
                  revisionId: pack.id,
                  packRevisionId: null,
                })
              }
              dataSet={{ testid: `content-bundled-${pack.document_id}` }}
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}

function PersonalContent(): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const myId = useMyId();
  const decision = useDecision(PERMISSION.puzzlesReadOwnContent);
  const ids = createMemo(() =>
    data
      .content()
      .documents.filter((doc) => doc.owner_id === myId())
      .toSorted(byContentId)
      .slice(0, data.pages.owned.limit())
      .filter((doc) => doc.deleted_at === null)
      .map((doc) => doc.id)
  );
  return (
    <>
      <Show
        when={decision().allowed}
        fallback={<DenialSurface decision={decision()} variant="compact" />}
      >
        <Show when={ids().length > 0}>
          <MenuSection title={<Trans>Your drafts and publications</Trans>}>
            <For each={ids()}>
              {(id) => {
                const draft = () => workingContentDraft(data.content(), id);
                const doc = () =>
                  data.content().documents.find((entry) => entry.id === id);
                return (
                  <MenuRow
                    title={(draft()?.title ?? '') || t`Untitled draft`}
                    value={
                      doc()?.status === 'published'
                        ? t`Published`
                        : doc()?.status === 'withdrawn'
                          ? t`Withdrawn`
                          : t`Draft`
                    }
                    onClick={() => game.open({ kind: 'edit', documentId: id })}
                    dataSet={{ testid: `content-draft-${id}` }}
                  />
                );
              }}
            </For>
          </MenuSection>
        </Show>
        <ContentLoadMore
          page={data.pages.owned}
          label={t`Load more of your drafts and publications`}
        />
      </Show>
      <ContentSavedAttempts mode="ordinary" />
      <ContentSavedAttempts mode="playtest" />
      <ContentLoadMore
        page={data.pages.attempts}
        label={t`Load earlier attempts`}
      />
    </>
  );
}

export function ContentLibraryScreen(): JSX.Element {
  const game = useContentGame();
  return (
    <EmbeddedScreen
      screenId="puzzle-content-library"
      title={game.title}
      subtitle={
        <Trans>
          Play published puzzles, continue your attempts, or build something of
          your own.
        </Trans>
      }
    >
      <ContentCreateControls />
      <BundledPacks />
      <PersonalContent />
      <PublishedContent />
    </EmbeddedScreen>
  );
}
