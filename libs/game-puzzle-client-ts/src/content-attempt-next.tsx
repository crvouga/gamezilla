import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { createMemo, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

export function ContentAttemptNext(props: {
  attempt: ContentAttempt;
  complete: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const next = createMemo(() => {
    const id = props.attempt.pack_revision_id;
    if (id === null || !props.complete) return null;
    return packProgress({
      content: data.content(),
      play: data.play(),
      packRevisionId: id,
    })?.items.find(
      (item) =>
        item.revisionId !== props.attempt.source_id &&
        item.status !== 'completed'
    );
  });
  return (
    <>
      <Show when={props.attempt.mode === 'playtest'}>
        <Button
          title={t`Return to builder`}
          variant="outline"
          intent="neutral"
          onClick={() =>
            game.open({ kind: 'edit', documentId: props.attempt.puzzle_id })
          }
        />
      </Show>
      <Show when={props.attempt.pack_revision_id}>
        {(id) => (
          <Button
            title={t`Pack overview`}
            dataSet={{ testid: 'content-return-pack' }}
            variant="outline"
            intent="neutral"
            onClick={() =>
              game.open({
                kind: 'edition',
                revisionId: id(),
                packRevisionId: null,
              })
            }
          />
        )}
      </Show>
      <Show when={next()}>
        {(item) => (
          <Button
            title={t`Next puzzle: ${item().title}`}
            onClick={() =>
              game.open({
                kind: 'edition',
                revisionId: item().revisionId,
                packRevisionId: props.attempt.pack_revision_id,
              })
            }
            dataSet={{ testid: 'content-next-puzzle' }}
          />
        )}
      </Show>
    </>
  );
}
