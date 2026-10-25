import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { type PongConfig, pongConfig } from '@libs/pong-shared-ts/pong-config';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';

export function pongSimulation(
  seed = 'pong',
  config: PongConfig = pongConfig()
) {
  const initial = initialPongState(
    config,
    createSeededRng(seed).fork('initial').random
  );
  return new FixedStepSimulation(initial, createPongStep(config), {
    tickRate: config.tickRate,
    seed,
    maxCatchUpTicks: config.maxCatchUpTicks,
    maxInputLeadTicks: config.maxInputLeadTicks,
    maxQueuedInputs: config.maxQueuedInputs,
  });
}
