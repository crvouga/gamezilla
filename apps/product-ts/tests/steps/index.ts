import '@libs/runtime-harness-ts/game-journey.steps';
import '@libs/runtime-harness-ts/pong-journey.steps';
import '@libs/runtime-harness-ts/quoridor-journey.steps';

// The one registration entry selects the runner's injected world.
// Live checks use server ports without loading the in-process browser app.
if (process.env['SPEC_WORLD'] !== 'live') await import('./developer-world');

import '@libs/runtime-harness-ts/journeys.steps';
import '@libs/runtime-harness-ts/custom-game-journey.steps';
import '@libs/runtime-harness-ts/multiplayer-journey.steps';
import './live-index';
