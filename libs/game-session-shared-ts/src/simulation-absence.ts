import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';

/**
 * Whether a persisted absence deadline is running for this execution. A
 * paused game waits for any absent controller; a continuing game waits only
 * when every controller is away.
 */
export function simulationAwaitsAbsence(
  execution: SimulationExecution | undefined
): execution is SimulationExecution & { readonly expiresAt: number } {
  return (
    execution !== undefined &&
    execution.expiresAt !== null &&
    execution.missing.length > 0 &&
    execution.phase !== 'completed' &&
    execution.phase !== 'abandoned'
  );
}

/**
 * Who wins when the deadline passes: in a two-seat game, the one seat that
 * stayed; otherwise nobody, and the game is abandoned. With more than two
 * seats a single absent person never forfeits the game for everyone.
 */
export function simulationAbsenceWinner(
  seats: readonly GameSide[],
  missing: readonly GameSide[]
): GameSide | null {
  if (seats.length !== 2 || missing.length !== 1) return null;
  return seats.find((side) => side !== missing[0]) ?? null;
}
