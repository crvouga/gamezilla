import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import {
  observeHeartsFirstTrick,
  playHeartsFirstTrick,
} from './hearts-trick-journey';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<JourneyWorld>();

When(
  'Alice passes three cards and plays the first trick of Hearts against bots from a fresh device',
  (w) => playHeartsFirstTrick(w.journey)
);

Then('Alice sees the first trick taken, with 12 cards left in her hand', (w) =>
  observeHeartsFirstTrick(w.journey)
);
