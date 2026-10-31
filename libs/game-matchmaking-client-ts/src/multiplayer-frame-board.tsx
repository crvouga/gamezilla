import { frameActionItems } from '@libs/game-session-client-ts/game-frame-play';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';

/** The matched game's board, tools and optional controls share one session. */
export function MultiplayerFrameBoard(props: {
  presentation: GamePresentation<JSX.Element>;
  board: GameFrameBoardProps;
}): JSX.Element {
  const frame = createMemo(() => props.presentation.frame);
  const session = createMemo(() => {
    const current = frame();
    return untrack(() => current.createBoard(props.board));
  });
  return (
    <StackVertical gap="sm">
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
