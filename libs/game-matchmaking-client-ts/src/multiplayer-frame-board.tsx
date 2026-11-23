import { frameActionItems } from '@libs/game-session-client-ts/game-frame-play';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  createEffect,
  createMemo,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

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
  createEffect(() => props.onLine?.(line()));
  onCleanup(() => props.onLine?.(null));
  return (
    <StackVertical gap="sm">
      <GameActionBar
        items={frameActionItems(
          session().actions(),
          props.board.testId,
          'before-board'
        )}
      />
      <Dynamic component={session().Board} />
      <GameActionBar
        items={frameActionItems(session().actions(), props.board.testId)}
      />
      <Show when={session().controls}>
        {(Controls) => <Dynamic component={Controls()} />}
      </Show>
    </StackVertical>
  );
}
