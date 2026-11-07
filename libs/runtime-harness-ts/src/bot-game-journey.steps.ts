import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import { observeBotGameJourney, startBotGameJourney } from './bot-game-journey';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<JourneyWorld>();

When('Alice starts {string} with bots from a fresh device', (w, game: string) =>
  startBotGameJourney(w.journey, game)
);

Then('Alice sees {string} under way against bots', (w, game: string) =>
  observeBotGameJourney(w.journey, game)
);
