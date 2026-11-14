import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { useContentPlay } from './use-content-play';

/**
 * An attempt's way around, on its details screen: a pack puzzle's
 * overview, or a playtest's way back to its builder.
 */
export function ContentAttemptNext(props: {
  attempt: ContentAttempt;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  return (
    <>
      <Show when={props.attempt.mode === 'playtest'}>
        <Button
          title={t`Return to builder`}
          variant="outline"
          intent="neutral"
          onClick={() =>
            game.open({
              kind: 'builder',
              documentId: props.attempt.puzzle_id,
            })
          }
          dataSet={{ testid: 'content-return-builder' }}
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
    </>
  );
}

/** Back where a solved puzzle came from: its pack, or the puzzles. */
function SolvedReturn(props: {
  inPack: boolean;
  onPack: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  return (
    <Show
      when={!props.inPack}
      fallback={
        <Button
          title={t`Back to the pack`}
          intent="neutral"
          variant="outline"
          fullWidth
          onClick={() => props.onPack()}
          dataSet={{ testid: 'content-solved-pack' }}
        />
      }
    >
      <Button
        title={t`Choose another puzzle`}
        intent="neutral"
        variant="outline"
        fullWidth
        onClick={() => game.open({ kind: 'library' })}
        dataSet={{ testid: 'content-solved-library' }}
      />
    </Show>
  );
}

/**
 * The solved board's one filled command onward: a pack's next unsolved
 * puzzle, straight onto its board (its saved attempt, or a new one); the
 * finished pack once every puzzle is solved; a playtest's builder; or,
 * for a puzzle on its own, the way back to the puzzles.
 */
export function ContentAttemptOnward(props: {
  attempt: ContentAttempt;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const play = useContentPlay();
  const pack = createMemo(() => {
    const id = props.attempt.pack_revision_id;
    return id === null
      ? null
      : packProgress({
          content: data.content(),
          play: data.play(),
          packRevisionId: id,
        });
  });
  const next = createMemo(
    () =>
      pack()?.items.find(
        (item) =>
          item.revisionId !== props.attempt.source_id &&
          item.status !== 'completed'
      ) ?? null
  );
  const openPack = (): void => {
    const id = props.attempt.pack_revision_id;
    if (id !== null)
      game.open({ kind: 'edition', revisionId: id, packRevisionId: null });
  };
  return (
    <>
      <Switch
        fallback={
          <SolvedReturn
            inPack={props.attempt.pack_revision_id !== null}
            onPack={openPack}
          />
        }
      >
        <Match when={props.attempt.mode === 'playtest'}>
          <Button
            title={t`Return to builder`}
            fullWidth
            onClick={() =>
              game.open({
                kind: 'builder',
                documentId: props.attempt.puzzle_id,
              })
            }
            dataSet={{ testid: 'content-solved-builder' }}
          />
        </Match>
        <Match when={next()}>
          {(item) => (
            <Button
              title={t`Next puzzle: ${item().title}`}
              fullWidth
              loading={play.starting() === item().revisionId}
              loadingLabel={t`Starting…`}
              onClick={() =>
                play.play({
                  revisionId: item().revisionId,
                  packRevisionId: props.attempt.pack_revision_id,
                })
              }
              dataSet={{ testid: 'content-next-puzzle' }}
            />
          )}
        </Match>
        <Match when={pack()?.complete}>
          <Button
            title={t`See the finished pack`}
            fullWidth
            onClick={openPack}
            dataSet={{ testid: 'content-finished-pack' }}
          />
        </Match>
      </Switch>
      <Show when={play.failure()}>
        {(failure) => (
          <ErrorState
            variant="compact"
            title={t`The next puzzle did not start`}
            body={failure().message}
            retry={{ onClick: play.retry }}
            dataSet={{ testid: 'content-start-failed' }}
          />
        )}
      </Show>
    </>
  );
}
