import { useLingui } from '@lingui/solid/macro';
import type { SpaceGameAction } from '@pkgs/ui-root-client-ts/space-types';
import type { Accessor } from 'solid-js';
import type { ContentAttemptRestartTools } from './content-attempt-restart';
import { useContentGame } from './content-game-context';
import type { useContentAttemptChange } from './use-content-attempt-change';

/**
 * The board's own commands, for the action bar: undo and redo of the
 * attempt's moves, and restart (once a new attempt is saved, the way into
 * it takes Restart's place).
 */
export function useContentAttemptControls(props: {
  writer: ReturnType<typeof useContentAttemptChange>;
  restart: ContentAttemptRestartTools;
  progress: Accessor<{
    complete: boolean;
    canUndo: boolean;
    canRedo: boolean;
  } | null>;
  /** The puzzle itself cannot be read: no command here can help. */
  unreadable: Accessor<boolean>;
}): Accessor<readonly SpaceGameAction[]> {
  const { t } = useLingui();
  const game = useContentGame();
  const locked = () => props.writer.pending() || props.unreadable();
  const history = (): readonly SpaceGameAction[] =>
    game.content.history === 'snapshots'
      ? [
          {
            id: 'undo',
            label: t`Undo`,
            disabled: locked() || props.progress()?.canUndo !== true,
            onPress: () => props.writer.execute({ kind: 'undo' }),
            testId: 'content-undo',
          },
          {
            id: 'redo',
            label: t`Redo`,
            disabled: locked() || props.progress()?.canRedo !== true,
            onPress: () => props.writer.execute({ kind: 'redo' }),
            testId: 'content-redo',
          },
        ]
      : [];
  const restart = (): SpaceGameAction => {
    const created = props.restart.created();
    return created === null
      ? {
          id: 'restart',
          label: t`Restart`,
          disabled: locked(),
          onPress: () => props.restart.ask(),
          testId: 'content-restart',
        }
      : {
          id: 'open-restart',
          label: t`Open restarted attempt`,
          onPress: () => game.open({ kind: 'attempt', attemptId: created }),
          testId: 'content-open-restart',
        };
  };
  return () => [...history(), restart()];
}
