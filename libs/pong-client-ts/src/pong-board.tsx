import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  createEffect,
  createMemo,
  createRenderEffect,
  type JSX,
  onCleanup,
  untrack,
} from 'solid-js';
import { PongBoardView, type PongBoardViewProps } from './pong-board-view';

/** The court with its sounds, releasing its controls when it closes. */
export function PongBoard(props: PongBoardViewProps): JSX.Element {
  const state = createMemo(() => pongPositionCodec.decode(props.position));
  usePongInputRelease(() => props.simulation);
  usePongSounds(state, () => props.sound);
  return <PongBoardView {...props} />;
}

/** Teardown uses the last mounted control surface, never a disposed Dynamic's props. */
function usePongInputRelease(
  current: () => GameSimulationControls | undefined
): void {
  let controls: GameSimulationControls | undefined;
  createRenderEffect(() => {
    controls = current();
  });
  onCleanup(() =>
    untrack(() => {
      for (const side of controls?.sides ?? [])
        controls?.onInput(side, { kind: 'direction', direction: 0 });
      controls?.onRelease();
    })
  );
}

function usePongSounds(
  state: () => PongState | null,
  enabled: () => boolean
): void {
  const engine = useOptionalSoundEngine();
  let previous: PongState['feedback'] | null = null;
  const feedback = createMemo(() => state()?.feedback);
  createEffect(() => {
    const current = feedback();
    if (current === undefined) return;
    if (previous !== null && enabled()) {
      const sound =
        current.points > previous.points
          ? 'gameplay.scoreIncrease'
          : current.paddles > previous.paddles
            ? 'gameplay.move'
            : current.walls > previous.walls
              ? 'gameplay.place'
              : null;
      if (sound !== null) engine?.().play(sound);
    }
    previous = current;
  });
}
