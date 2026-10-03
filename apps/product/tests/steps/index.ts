// The one registration entry selects the runner's injected world.
// Live checks use server ports without loading the in-process browser app.
if (process.env['SPEC_WORLD'] !== 'live') await import('./developer-world');

import '@libs/runtime/steps/journeys.steps';
import '@libs/runtime/steps/custom-game-journey.steps';
import './live-index';
