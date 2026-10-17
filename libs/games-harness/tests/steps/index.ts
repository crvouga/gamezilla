/**
 * Steps entry for `specs/games/`: what every game offers alike, run once for
 * each enrolled game that offers what the feature shows, in a world where
 * every registered game is offered. A failure names the game.
 */

import '@libs/harness/platform';
import '@libs/friends-harness/spaces.steps';
import { openGamesHarness } from '@libs/games-harness/games-system';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { defineScenarioVariants } from '@pkgs/gherkin-shared/registry';
import { capabilitiesShown } from './game-world';

defineScenarioVariants((ctx) => {
  const shown = capabilitiesShown(ctx.featureUri);
  return HARNESS_GAMES.filter((game) =>
    shown.every((capability) =>
      game.shared.turnGame.capabilities.includes(capability)
    )
  ).map((game) => ({ id: game.shared.id, label: game.label }));
});

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openGamesHarness);
