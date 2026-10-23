import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { ContentAttemptNext } from './content-attempt-next';
import { ContentAttemptRestart } from './content-attempt-restart';
import { useContentGame } from './content-game-context';
import type { useContentAttemptChange } from './use-content-attempt-change';

export function ContentAttemptControls(props: {
  attempt: ContentAttempt;
  writer: ReturnType<typeof useContentAttemptChange>;
  progress: { complete: boolean; canUndo: boolean; canRedo: boolean } | null;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  return (
    <StackHorizontal gap="sm" wrap>
      <Show when={game.content.history === 'snapshots'}>
        <Button
          title={t`Undo`}
          intent="neutral"
          variant="outline"
          disabled={props.writer.pending() || !props.progress?.canUndo}
          onClick={() => props.writer.execute({ kind: 'undo' })}
          dataSet={{ testid: 'content-undo' }}
        />
        <Button
          title={t`Redo`}
          intent="neutral"
          variant="outline"
          disabled={props.writer.pending() || !props.progress?.canRedo}
          onClick={() => props.writer.execute({ kind: 'redo' })}
          dataSet={{ testid: 'content-redo' }}
        />
      </Show>
      <ContentAttemptRestart
        attempt={props.attempt}
        disabled={props.writer.pending()}
      />
      <ContentAttemptNext
        attempt={props.attempt}
        complete={props.progress?.complete ?? false}
      />
    </StackHorizontal>
  );
}
