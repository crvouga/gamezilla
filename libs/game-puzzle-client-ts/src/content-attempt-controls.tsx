import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import {
  ContentAttemptRestart,
  type ContentAttemptRestartTools,
} from './content-attempt-restart';
import { useContentGame } from './content-game-context';
import type { useContentAttemptChange } from './use-content-attempt-change';

/** The board's own commands: undo and redo of the attempt's moves, and restart. */
export function ContentAttemptControls(props: {
  writer: ReturnType<typeof useContentAttemptChange>;
  restart: ContentAttemptRestartTools;
  progress: { complete: boolean; canUndo: boolean; canRedo: boolean } | null;
  /** The puzzle itself cannot be read: no command here can help. */
  unreadable: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const locked = () => props.writer.pending() || props.unreadable;
  return (
    <StackHorizontal gap="sm" wrap shrink>
      <Show when={game.content.history === 'snapshots'}>
        <Button
          title={t`Undo`}
          intent="neutral"
          variant="outline"
          size="sm"
          disabled={locked() || !props.progress?.canUndo}
          onClick={() => props.writer.execute({ kind: 'undo' })}
          dataSet={{ testid: 'content-undo' }}
        />
        <Button
          title={t`Redo`}
          intent="neutral"
          variant="outline"
          size="sm"
          disabled={locked() || !props.progress?.canRedo}
          onClick={() => props.writer.execute({ kind: 'redo' })}
          dataSet={{ testid: 'content-redo' }}
        />
      </Show>
      <ContentAttemptRestart tools={props.restart} disabled={locked()} />
    </StackHorizontal>
  );
}
