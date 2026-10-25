import { expect, test } from 'bun:test';
import { withSimulationBots } from '@libs/game-session-shared-ts/simulation-bots';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { pongBot } from '@libs/pong-shared-ts/pong-bot';
import { pongCodec } from '@libs/pong-shared-ts/pong-codec';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import {
  initialPongState,
  type PongInput,
  parsePongInput,
} from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { pongSimulation } from './pong-fixture';

const direction = fc.constantFrom(-1 as const, 0 as const, 1 as const);
const config = pongConfig({ targetScore: 3 });

test('the scoring boundary creates one terminal result and terminal state is absorbing for every score target', () => {
  assertProperty(
    'Pong terminal scoring invariant',
    fc.property(fc.integer({ min: 1, max: 99 }), (targetScore) => {
      const chosen = pongConfig({ targetScore });
      const initial = initialPongState(chosen, () => 0);
      const state = {
        ...initial,
        phase: 'playing' as const,
        countdown: 0,
        score: { left: targetScore - 1, right: 0 },
        ball: {
          x: chosen.width + chosen.ballRadius - 1,
          y: chosen.height / 2,
          vx: chosen.ballSpeed,
          vy: 0,
        },
        feedback: {
          walls: 0,
          paddles: 0,
          points: targetScore - 1,
          serves: targetScore,
        },
      };
      const step = createPongStep(chosen);
      const context = {
        tick: 1,
        deltaMs: 1000 / chosen.tickRate,
        elapsedMs: 1000 / chosen.tickRate,
        random: () => 0.5,
      };
      const completed = step(state, [], context);
      expect(completed.score).toEqual({ left: targetScore, right: 0 });
      expect(completed.winner).toBe('left');
      expect(completed.phase).toBe('completed');
      expect(completed.feedback.points).toBe(targetScore);
      expect(completed.ball.vx).toBe(0);
      expect(
        pongCodec(chosen).decode(pongCodec(chosen).encode(completed))
      ).toEqual(completed);
      expect(
        step(
          completed,
          [
            {
              playerId: 'left',
              sequence: 2,
              tick: 2,
              value: { kind: 'direction', direction: 1 },
            },
          ],
          { ...context, tick: 2 }
        )
      ).toBe(completed);
    })
  );
});

test('seeded replay is independent of simultaneous input delivery order and every state round-trips', () => {
  assertProperty(
    'Pong deterministic replay and codec',
    fc.property(
      fc.integer(),
      fc.array(fc.tuple(direction, direction), {
        minLength: 180,
        maxLength: 360,
      }),
      (seed, controls) => {
        const a = pongSimulation(String(seed), config);
        const b = pongSimulation(String(seed), config);
        const codec = pongCodec(config);
        for (const [index, [left, right]] of controls.entries()) {
          const tick = index + 1;
          const inputs = [
            {
              playerId: 'left',
              sequence: tick,
              tick,
              value: { kind: 'direction', direction: left } as PongInput,
            },
            {
              playerId: 'right',
              sequence: tick,
              tick,
              value: { kind: 'direction', direction: right } as PongInput,
            },
          ];
          const accepted = inputs.every((input) => a.enqueue(input).accepted);
          const reversedAccepted = [...inputs]
            .reverse()
            .every((input) => b.enqueue(input).accepted);
          if (!accepted || !reversedAccepted)
            throw new Error(`input rejected at tick ${tick}`);
          a.advanceTicks(1);
          b.advanceTicks(1);
          const state = a.snapshot();
          const encoded = JSON.stringify(state.state);
          if (JSON.stringify(state) !== JSON.stringify(b.snapshot()))
            throw new Error(`replay diverged at tick ${tick}`);
          const decoded = codec.decode(encoded);
          if (decoded === null || codec.encode(decoded) !== encoded)
            throw new Error(`checkpoint did not round-trip at tick ${tick}`);
        }
      }
    )
  );
});

test('paddle displacement, boundaries and score increments remain bounded under arbitrary normalized controls', () => {
  assertProperty(
    'Pong motion invariants',
    fc.property(
      fc.array(fc.integer({ min: 0, max: 1000 }), {
        minLength: 300,
        maxLength: 600,
      }),
      (targets) => {
        const simulation = pongSimulation('geometry', config);
        let previous = simulation.snapshot().state;
        for (const [index, target] of targets.entries()) {
          const tick = index + 1;
          simulation.enqueue({
            playerId: 'left',
            sequence: tick,
            tick,
            value: { kind: 'target', target: target / 1000 },
          });
          simulation.advanceTicks(1);
          const state = simulation.snapshot().state;
          for (const side of ['left', 'right'] as const) {
            expect(state.paddles[side].y).toBeGreaterThanOrEqual(
              config.paddleHeight / 2
            );
            expect(state.paddles[side].y).toBeLessThanOrEqual(
              config.height - config.paddleHeight / 2
            );
            expect(
              Math.abs(state.paddles[side].y - previous.paddles[side].y)
            ).toBeLessThanOrEqual(config.paddleSpeed / config.tickRate + 1e-8);
            expect(
              state.score[side] - previous.score[side]
            ).toBeGreaterThanOrEqual(0);
          }
          expect(
            state.feedback.points - previous.feedback.points
          ).toBeLessThanOrEqual(1);
          if (previous.phase === 'completed') expect(state).toBe(previous);
          previous = state;
        }
      }
    )
  );
});

test('continuous bot decisions remain valid at every difficulty and use ordinary paddle speed constraints', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const step = withSimulationBots(
      createPongStep(config),
      [
        { playerId: 'left', input: pongBot(config, 'left', difficulty) },
        { playerId: 'right', input: pongBot(config, 'right', difficulty) },
      ],
      parsePongInput
    );
    const simulation = new FixedStepSimulation(
      initialPongState(config, () => 0),
      step,
      {
        tickRate: config.tickRate,
        seed: difficulty,
        maxCatchUpTicks: 8,
        maxQueuedInputs: 32,
        maxInputLeadTicks: 30,
      }
    );
    let previous = simulation.snapshot().state;
    for (let index = 0; index < 1800; index++) {
      simulation.advanceTicks(1);
      const state = simulation.snapshot().state;
      for (const side of ['left', 'right'] as const) {
        expect(parsePongInput(state.paddles[side].input)).not.toBeNull();
        expect(
          Math.abs(state.paddles[side].y - previous.paddles[side].y)
        ).toBeLessThanOrEqual(config.paddleSpeed / config.tickRate + 1e-8);
      }
      previous = state;
    }
  }
});

test('input and checkpoint codecs reject malformed numbers, extra controls and inconsistent terminal scores', () => {
  for (const value of [
    { kind: 'direction', direction: 2 },
    { kind: 'target', target: NaN },
    { kind: 'target', target: Infinity },
    { kind: 'target', target: -1 },
    { kind: 'target', target: 0.5, score: 3 },
  ])
    expect(parsePongInput(value)).toBeNull();
  const state = initialPongState(config, () => 0);
  const codec = pongCodec(config);
  expect(codec.decode('not a state')).toBeNull();
  expect(
    codec.decode(
      JSON.stringify({
        ...state,
        phase: 'completed',
        countdown: 0,
        winner: 'left',
      })
    )
  ).toBeNull();
  expect(
    codec.decode(
      JSON.stringify({
        ...state,
        paddles: { ...state.paddles, left: { ...state.paddles.left, y: -1 } },
      })
    )
  ).toBeNull();
  expect(
    codec.decode(
      JSON.stringify({ ...state, feedback: { ...state.feedback, points: 1 } })
    )
  ).toBeNull();
});
