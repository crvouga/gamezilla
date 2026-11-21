import { expect, test } from 'bun:test';
import { createPongLiveInputs } from '@libs/pong-client-ts/pong-live-inputs.example';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';

// regression: pong-live-story-held-input-expires
test('live story refreshes a held key beyond its lease and releases it', () => {
  const config = pongConfig();
  const step = createPongStep(config);
  const inputs = createPongLiveInputs();
  let state = initialPongState(config, () => 0);
  let tick = 0;
  const advance = () => {
    tick += 1;
    state = step(state, inputs.sample(tick), {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0.3,
    });
  };
  inputs.set('white', { kind: 'direction', direction: 1 });
  for (let i = 0; i < config.inputLeaseTicks + 1; i++) advance();
  const before = state.paddles.left.y;
  expect(before - config.paddleHeight / 2).toBe(518);
  advance();
  expect(state.paddles.left.y).toBeGreaterThan(before);
  inputs.release();
  const released = state.paddles.left.y;
  for (let i = 0; i < config.inputLeaseTicks + 2; i++) advance();
  expect(state.paddles.left.y).toBe(released);
  inputs.set('white', { kind: 'direction', direction: -1 });
  advance();
  expect(state.paddles.left.y).toBeLessThan(released);
});
