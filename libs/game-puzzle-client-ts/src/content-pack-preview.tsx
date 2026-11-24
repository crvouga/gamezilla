import { workingContentDraft } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { ArrowLeftIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentPreview } from './content-preview';

/** One of a pack's puzzles, as its preview lists it. */
export type ContentPackPreviewItem = {
  readonly id: string;
  /** Empty when the puzzle can no longer be read. */
  readonly title: string;
  readonly published: boolean;
};

/** The puzzle being previewed: where it sits in the pack, and its board. */
export type ContentPackPreviewed = {
  readonly title: string;
  /** Its place in the pack, from 1. */
  readonly position: number;
  readonly board: JSX.Element;
};

/**
 * A pack draft as a solver meets it, presentational: its puzzles in order,
 * each opening its own preview; a previewed puzzle is named with its place
 * in the pack (`Puzzle 2 of 3`) over its board.
 */
export function ContentPackPreviewView(props: {
  items: readonly ContentPackPreviewItem[];
  previewed: ContentPackPreviewed | null;
  onSelect: (puzzleId: string) => void;
  /** Returns from a previewed puzzle to the pack's list. */
  onBack: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-pack-preview' }}>
      <Show
        when={props.previewed}
        fallback={
          <Show
            when={props.items.length > 0}
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
              <For each={props.items}>
                {(item) => (
                  <MenuRow
                    dataSet={{ testid: `content-preview-puzzle-${item.id}` }}
                    title={item.title || t`Unavailable puzzle`}
                    caption={
                      item.published
                        ? t`Published`
                        : t`Draft, not yet in a published pack`
                    }
                    onClick={() => props.onSelect(item.id)}
                  />
                )}
              </For>
            </MenuSection>
          </Show>
        }
      >
        {(puzzle) => (
          <>
            <StackVertical gap="xs">
              <P variant="caption" tone="secondary">
                {t`Puzzle ${puzzle().position} of ${props.items.length}`}
              </P>
              <H2 size="navigationTitle" testId="content-preview-puzzle-title">
                {puzzle().title || t`Untitled draft`}
              </H2>
            </StackVertical>
            {puzzle().board}
            <StackHorizontal>
              <Button
                title={t`Back to the pack`}
                intent="neutral"
                variant="outline"
                startIcon={<ArrowLeftIcon size={16} />}
                onClick={() => props.onBack()}
                dataSet={{ testid: 'content-preview-back' }}
              />
            </StackHorizontal>
          </>
        )}
      </Show>
    </StackVertical>
  );
}

/**
 * A pack draft as a solver meets it: its puzzles in order, each opening
 * its own preview (`puzzleId`); Back returns to the list.
 */
export function ContentPackPreview(props: {
  definition: string;
  /** The puzzle previewed; `null` shows the pack's list. */
  puzzleId: string | null;
  onSelect: (puzzleId: string) => void;
  /** Returns to the pack's list. */
  onBack: () => void;
}): JSX.Element {
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
  const items = createMemo((): ContentPackPreviewItem[] =>
    (pack()?.items ?? []).map((item) => ({
      id: item.puzzleId,
      title: entry(item.puzzleId)?.title ?? '',
      published:
        data.content().documents.find((doc) => doc.id === item.puzzleId)
          ?.status === 'published',
    }))
  );
  const previewed = createMemo((): ContentPackPreviewed | null => {
    const id = props.puzzleId;
    const puzzle = id === null ? undefined : entry(id);
    if (id === null || puzzle === undefined || puzzle === null) return null;
    return {
      title: puzzle.title,
      position: items().findIndex((item) => item.id === id) + 1,
      board: <ContentPreview definition={puzzle.definition} />,
    };
  });
  return (
    <ContentPackPreviewView
      items={items()}
      previewed={previewed()}
      onSelect={props.onSelect}
      onBack={props.onBack}
    />
  );
}
