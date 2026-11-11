import { Trans } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import type { useContentDraftSave } from './use-content-draft-save';

/** A puzzle draft's board: the game's own editor on the working copy. */
export function ContentAuthorStage(props: {
  writer: ReturnType<typeof useContentDraftSave>;
  disabled: boolean;
}): JSX.Element {
  const game = useContentGame();
  return (
    <Show
      when={game.client.authoring?.Editor}
      keyed
      fallback={
        <Notice>
          <Trans>
            This game has no editor for puzzle details. Metadata and kept copies
            remain available.
          </Trans>
        </Notice>
      }
    >
      {(Editor) => (
        <Editor
          definition={props.writer.body().definition}
          disabled={props.disabled}
          onChange={(definition) =>
            props.writer.change({ ...props.writer.body(), definition })
          }
        />
      )}
    </Show>
  );
}
