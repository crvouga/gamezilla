import { workingContentDraft } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentPreview } from './content-preview';

/**
 * A pack draft as a solver meets it: its puzzles in order, each opening
 * its own preview (`puzzleId`); Back returns to the list.
 */
export function ContentPackPreview(props: {
  definition: string;
  /** The puzzle previewed; `null` shows the pack's list. */
  puzzleId: string | null;
  onSelect: (puzzleId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const pack = createMemo(() => decodePackDefinition(props.definition));
  const entry = (id: string) => {
    const item = pack()?.items.find((value) => value.puzzleId === id);
    const doc = data.content().documents.find((value) => value.id === id);
    const revision = data
      .content()
      .revisions.find(
        (value) => value.id === (item?.revisionId ?? doc?.published_revision_id)
      );
    return revision ?? workingContentDraft(data.content(), id);
  };
  const previewed = () =>
    props.puzzleId === null ? null : (entry(props.puzzleId) ?? null);
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-pack-preview' }}>
      <Show
        when={previewed()}
        fallback={
          <Show
            when={(pack()?.items.length ?? 0) > 0}
            fallback={
              <EmptyState
                variant="compact"
                title={t`This pack has no puzzles yet`}
                body={t`Open Puzzles to add a published puzzle or create a new draft.`}
              />
            }
          >
            <MenuSection
              title={<Trans>Pack preview</Trans>}
              footer={
                <Trans>
                  People can choose any puzzle. Only published editions can be
                  included when you publish this pack.
                </Trans>
              }
            >
              <For each={pack()?.items.map((item) => item.puzzleId) ?? []}>
                {(id) => (
                  <MenuRow
                    dataSet={{ testid: `content-preview-puzzle-${id}` }}
                    title={(entry(id)?.title ?? '') || t`Unavailable puzzle`}
                    value={
                      data.content().documents.find((doc) => doc.id === id)
                        ?.status === 'published'
                        ? t`Published`
                        : t`Draft`
                    }
                    onClick={() => props.onSelect(id)}
                  />
                )}
              </For>
            </MenuSection>
          </Show>
        }
      >
        {(puzzle) => (
          <>
            <H2 size="navigationTitle" testId="content-preview-puzzle-title">
              {puzzle().title || t`Untitled draft`}
            </H2>
            <ContentPreview definition={puzzle().definition} />
          </>
        )}
      </Show>
    </StackVertical>
  );
}
