import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { BooksArt, PuzzleArt } from '@pkgs/ui-root-client-ts/illustration';
import {
  PreviewThumbnail,
  type PreviewThumbnailSize,
} from '@pkgs/ui-root-client-ts/preview-thumbnail';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

/**
 * What a row opens, pictured: the puzzle's board (a pack's first puzzle,
 * on stacked sheets), or the kind's icon while there is no board to draw.
 */
export function ContentThumbnail(props: {
  kind: ContentKind;
  /** The puzzle definition to draw; absent shows the kind's icon. */
  preview: string | undefined;
  /** The game's board preview; absent shows the kind's icon. */
  renderPreview: ((definition: string) => JSX.Element) | undefined;
  size?: PreviewThumbnailSize | undefined;
}): JSX.Element {
  const board = () =>
    props.renderPreview === undefined || !props.preview
      ? undefined
      : props.renderPreview;
  return (
    <PreviewThumbnail
      size={props.size}
      stacked={props.kind === 'pack'}
      dataSet={{ testid: 'content-thumbnail', kind: props.kind }}
    >
      <Show
        when={board()}
        fallback={
          <Show when={props.kind === 'pack'} fallback={<PuzzleArt size={96} />}>
            <BooksArt size={96} />
          </Show>
        }
      >
        {(render) => <>{render()(props.preview ?? '')}</>}
      </Show>
    </PreviewThumbnail>
  );
}
