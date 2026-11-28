import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<JourneyWorld>();

When('they open the app and choose Settings', async (w) => {
  w.opening = await w.journey.openAndChooseSettings();
});

Then(
  'they can open Settings in under one second without seeing an opening screen',
  (w) => {
    const result = w.opening;
    if (!result) throw new Error('No app opening was observed');
    if (result.kind === 'simulated') {
      if (!result.settingsVisible) throw new Error('Settings did not open');
      return;
    }
    if (
      result.settingsAtMs === null ||
      result.settingsAtMs >= 1000 ||
      result.spinnerAtMs !== null ||
      !result.runtimeSettingsVisible
    )
      throw new Error(`Opening missed its objective: ${JSON.stringify(result)}`);
  }
);
