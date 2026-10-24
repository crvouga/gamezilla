import { expect, test } from 'bun:test';
import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';

test('the automation catalog contains actual registered adapters only', () => {
  // regression: simulation-automation-catalog-undefined — Pong has no discrete-turn adapter.
  expect(GAME_AUTOMATIONS).not.toContain(undefined);
  expect(GAME_AUTOMATIONS.length).toBeGreaterThan(0);
  for (const definition of GAME_DEFINITIONS)
    if (definition.automation !== undefined)
      expect(GAME_AUTOMATIONS).toContain(definition.automation);
});
