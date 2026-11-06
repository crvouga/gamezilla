import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { PreviewCard } from '@pkgs/ui-root-client-ts/preview-card-grid';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { ContentThumbnail } from './content-thumbnail';

/** How many of a pack's puzzles the person has solved. */
export type ContentLibraryProgress = {
  readonly completed: number;
  readonly total: number;
};

/**
 * Where the person stands with a pack: how many of its puzzles are solved.
 * On one of its puzzles' cards the line names the pack first, so the count
 * reads as the pack's, never as the puzzle's own; on a solved puzzle's card
 * it says the puzzle is solved, then where the pack stands.
 */
export function ContentProgressLine(props: {
  progress: ContentLibraryProgress;
  /** The pack's name, when the card is one of its puzzles. */
  pack?: string | undefined;
  /** The card's puzzle is solved. */
  solved?: boolean | undefined;
}): JSX.Element {
  const { t } = useLingui();
  // Non-breaking spaces keep the count one phrase when the line wraps.
  const count = () =>
    t`${props.progress.completed}\u00a0of\u00a0${props.progress.total}`;
  const solved = () => t`${count()}\u00a0solved`;
  return (
    <Text variant="inherit" testId="content-progress">
      <Show when={props.pack} fallback={solved()}>
        {(pack) =>
          props.solved === true
            ? t`Solved · ${count()} in ${pack()}`
            : t`Pack: ${pack()} · ${solved()}`
        }
      </Show>
    </Text>
  );
}

/**
 * One thing in the library as a card: its board, its title (never cut
 * short), its chips and, for a pack, how much of it is solved.
 */
export function ContentLibraryCard(props: {
  kind: ContentKind;
  title: string;
  preview: string | undefined;
  renderPreview: ((definition: string) => JSX.Element) | undefined;
  caption?: JSX.Element | undefined;
  meta?: JSX.Element | undefined;
  onOpen: () => void;
  testid: string;
}): JSX.Element {
  return (
    <PreviewCard
      picture={
        <ContentThumbnail
          size="fill"
          renderPreview={props.renderPreview}
          kind={props.kind}
          preview={props.preview}
        />
      }
      title={props.title}
      caption={props.caption}
      meta={props.meta}
      onClick={() => props.onOpen()}
      dataSet={{ testid: props.testid }}
    />
  );
}
