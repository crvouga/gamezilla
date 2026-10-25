import type { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * A board's control surface over the current replica. Its handlers check the
 * sides it advertises and read no reactive state: a board releasing its input
 * while it is disposed must not re-run the memos disposing it.
 */
export function simulationControls(surface: {
  readonly sides: readonly GameSide[];
  readonly paused: boolean;
  readonly stale: boolean;
  readonly replica: () => SimulationReplica | null | undefined;
}): GameSimulationControls {
  const { sides, replica } = surface;
  return {
    sides,
    paused: surface.paused,
    stale: surface.stale,
    onInput: (side, input) => {
      if (sides.includes(side)) replica()?.control(side, input);
    },
    onRelease: () => replica()?.release(),
  };
}
