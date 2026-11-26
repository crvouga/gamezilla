import { frameActionItems } from '@libs/game-session-client-ts/game-frame-play';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { dynamic, type JSX } from '@solidjs/web';
import { createEffect, createMemo, onCleanup, Show, untrack } from 'solid-js';

/**
 * The matched game's board, tools and optional controls share one session.
 * The board's own words about live play (a round, who rides) go to
 * `onLine`, for the stage's one status line: nothing is written around the
 * board that could move it.
 */
export function MultiplayerFrameBoard(props: {
  presentation: GamePresentation<JSX.Element>;
  board: GameFrameBoardProps;
  onLine?: ((line: string | null) => void) | undefined;
}): JSX.Element {
  const frame = createMemo(() => props.presentation.frame);
  const session = createMemo(() => {
    const current = frame();
    return untrack(() => current.createBoard(props.board));
  });
  const line = createMemo(() => session().line?.() ?? null);
  // The listener is read when a line is told, never tracked: a new
  // listener alone repeats nothing.
  const tell = (value: string | null): void => {
    untrack(() => props.onLine)?.(value);
  };
  createEffect(line, tell);
  onCleanup(() => tell(null));
  const Board = dynamic(() => session().Board);
  const Controls = dynamic(() => session().controls);
  return (
    <StackVertical gap="sm">
      <Board />
      <GameActionBar
        items={frameActionItems(
          session().actions(),
          props.board.testId,
          'before-board'
        )}
      />
      <GameActionBar
        items={frameActionItems(session().actions(), props.board.testId)}
      />
      <Show when={session().controls}>
        <Controls />
      </Show>
    </StackVertical>
  );
}
