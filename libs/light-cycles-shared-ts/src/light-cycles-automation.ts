import type { SimulationGame } from '@libs/game-session-shared-ts/game-definition';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { lightCyclesConfig } from './light-cycles-config';
import { parseLightCyclesInput } from './light-cycles-input';

/**
 * A synthetic user steers through the rendered direction pad; the normal
 * replica stamps rounds' commands with sequences and basis ticks.
 */
export function lightCyclesAutomation(
  simulation: RegisteredSimulation
): NonNullable<SimulationGame['continuousAutomation']> {
  const config = lightCyclesConfig();
  const deltaMs = 1000 / config.tickRate;
  const intervalMs = config.movementTicks * deltaMs;
  return {
    intervalMs,
    choose(position, side, context) {
      const state = simulation.codec.decode(position);
      if (state === null || simulation.result(state) !== null) return null;
      // The bot decides as on the tick just before a movement step.
      const movement = Math.floor(context.elapsedMs / intervalMs);
      const tick = (movement + 1) * config.movementTicks;
      const deciding = { ...state, phaseTick: config.movementTicks - 1 };
      return simulation.bots!.input(deciding, side, 'medium', {
        tick,
        deltaMs,
        elapsedMs: tick * deltaMs,
        random: context.random,
      });
    },
    async perform(ui, board, side, value) {
      const input = parseLightCyclesInput(value);
      if (input === null)
        throw new Error('Invalid automated Light Cycles turn');
      await ui.get(`${board}-${side}-pad-${input.heading}`).tap();
    },
  };
}
