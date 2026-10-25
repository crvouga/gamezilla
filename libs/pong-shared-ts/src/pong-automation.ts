import type { SimulationGame } from '@libs/game-session-shared-ts/game-definition';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { pongReactionTicks } from './pong-bot';
import { pongConfig } from './pong-config';
import { parsePongInput } from './pong-state';

/** The population drives the real slider; the normal replica assigns input ticks and sequences. */
export function pongAutomation(
  simulation: RegisteredSimulation
): NonNullable<SimulationGame['continuousAutomation']> {
  const config = pongConfig();
  const reactionTicks = pongReactionTicks(config, 'medium');
  const deltaMs = 1000 / config.tickRate;
  const intervalMs = reactionTicks * deltaMs;
  return {
    intervalMs,
    choose(position, side, context) {
      const state = simulation.codec.decode(position);
      if (state === null || simulation.result(state) !== null) return null;
      // This is the bot's reaction clock, not the authority's committed tick.
      const tick =
        1 + Math.floor(context.elapsedMs / intervalMs) * reactionTicks;
      return simulation.bots!.input(state, side, 'medium', {
        tick,
        deltaMs,
        elapsedMs: (tick - 1) * deltaMs,
        random: context.random,
      });
    },
    async perform(ui, board, side, value) {
      const input = parsePongInput(value);
      if (input === null || input.kind !== 'target')
        throw new Error('Invalid automated Pong target');
      await ui
        .get(`${board}-${side}-control`)
        .input(String(Math.round(input.target * 1000)));
    },
  };
}
