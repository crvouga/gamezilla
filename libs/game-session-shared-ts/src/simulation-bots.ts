import type {
  SimulationContext,
  SimulationInput,
  SimulationStep,
} from '@pkgs/turn-game-shared-ts/simulation';

export type SimulationBot<S, I> = {
  readonly playerId: string;
  readonly input: (state: S, context: SimulationContext) => I;
};

/** Continuous bots run headlessly through the same validated input shape as people. */
export function withSimulationBots<S, I>(
  step: SimulationStep<S, I>,
  bots: readonly SimulationBot<S, I>[],
  parseInput: (value: unknown) => I | null
): SimulationStep<S, I> {
  const sorted = [...bots].sort((a, b) =>
    a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0
  );
  if (new Set(sorted.map((bot) => bot.playerId)).size !== sorted.length)
    throw new Error('duplicate simulation bot player');
  return (state, inputs, context) => {
    const generated: SimulationInput<I>[] = sorted.map((bot) => {
      const value = parseInput(bot.input(state, context));
      if (value === null)
        throw new Error('simulation bot produced invalid input');
      return {
        playerId: bot.playerId,
        sequence: context.tick,
        tick: context.tick,
        value,
      };
    });
    const merged = [...inputs, ...generated].sort((a, b) =>
      a.playerId < b.playerId
        ? -1
        : a.playerId > b.playerId
          ? 1
          : a.sequence - b.sequence
    );
    if (
      inputs.some((input) =>
        sorted.some((bot) => bot.playerId === input.playerId)
      )
    )
      throw new Error(
        'a simulation player cannot be controlled by a person and a bot'
      );
    return step(state, merged, context);
  };
}
