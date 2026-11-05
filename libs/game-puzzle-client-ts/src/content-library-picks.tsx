import type { ContentRevision } from '@libs/game-puzzle-shared-ts/content-types';
import { Trans } from '@lingui/solid/macro';
import { PreviewCardGrid } from '@pkgs/ui-root-client-ts/preview-card-grid';
import { For, type JSX, Show } from 'solid-js';
import {
  ContentDifficultyChip,
  ContentKindChip,
  ContentRowCaption,
} from './content-chips';
import {
  ContentLibraryCard,
  type ContentLibraryProgress,
  ContentProgressLine,
} from './content-library-card';

/** A shipped or published puzzle or pack Browse lists. */
export type ContentPick = Pick<
  ContentRevision,
  'id' | 'kind' | 'title' | 'description' | 'difficulty'
> & {
  readonly preview?: string | undefined;
  readonly progress?: ContentLibraryProgress | undefined;
};

/** Fewer unfinished puzzles than this leave the Continue tab sparse. */
const SPARSE_CONTINUE = 4;

/** How many picks follow a sparse Continue: one row of the card grid. */
const PICKS = 4;

/**
 * Browse's own puzzles and packs (the starter packs, then what is
 * published) for a Continue tab with little in it: never a puzzle Continue
 * already lists, at most one row of them.
 */
export function continuePicks(
  editions: readonly ContentPick[],
  unfinishedTitles: readonly string[]
): readonly ContentPick[] {
  if (unfinishedTitles.length >= SPARSE_CONTINUE) return [];
  const listed = new Set(unfinishedTitles);
  return editions
    .filter((edition) => edition.kind === 'pack' || !listed.has(edition.title))
    .slice(0, PICKS);
}

/**
 * Under a sparse Continue: "More to play", Browse's next puzzles and packs
 * as the same cards Browse shows, so the tab never ends in a band of empty
 * page after one or two rows.
 */
export function ContentMoreToPlay(props: {
  readonly picks: readonly ContentPick[];
  readonly renderPreview: ((definition: string) => JSX.Element) | undefined;
  readonly onOpenEdition: (revisionId: string) => void;
}): JSX.Element {
  return (
    <Show when={props.picks.length > 0}>
      <PreviewCardGrid
        title={<Trans>More to play</Trans>}
        dataSet={{ testid: 'content-library-more-to-play' }}
      >
        <For each={props.picks}>
          {(pick) => (
            <ContentLibraryCard
              kind={pick.kind}
              title={pick.title}
              preview={pick.preview}
              renderPreview={props.renderPreview}
              caption={
                <ContentRowCaption description={pick.description}>
                  <ContentKindChip kind={pick.kind} />
                  <Show when={pick.difficulty}>
                    {(difficulty) => (
                      <ContentDifficultyChip difficulty={difficulty()} />
                    )}
                  </Show>
                </ContentRowCaption>
              }
              meta={
                pick.progress === undefined ||
                pick.progress.total === 0 ? undefined : (
                  <ContentProgressLine progress={pick.progress} />
                )
              }
              onOpen={() => props.onOpenEdition(pick.id)}
              testid={`content-pick-${pick.id}`}
            />
          )}
        </For>
      </PreviewCardGrid>
    </Show>
  );
}
