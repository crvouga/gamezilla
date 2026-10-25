import { expect, test } from 'bun:test';
import {
  defineGame,
  type SimulationGame,
} from '@libs/game-session-shared-ts/game-definition';
import { continuousRaceGame } from './reference-continuous-game';

test('continuous input automation registers without a turn decision or legal move list', () => {
  // regression: continuous-automation-registration-dropped
  const continuous = {
    intervalMs: 100,
    choose: () => 3,
    perform: async () => {},
  };
  const definition = defineGame({
    rules: continuousRaceGame.registration.rules,
    simulation: continuousRaceGame.registration.simulation!,
    capabilities: continuousRaceGame.capabilities,
    continuousAutomation: continuous,
  } as SimulationGame);
  expect(definition.automation).toMatchObject({ continuous });
  expect(definition.automation).not.toHaveProperty('turns');
});
