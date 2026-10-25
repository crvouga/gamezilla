import { afterEach, expect, test } from 'bun:test';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import {
  SimulationFailure,
  type SimulationReproduction,
} from '@libs/game-session-shared-ts/simulation-failure';
import { context, propagation, trace } from '@opentelemetry/api';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { recordStructuredLog } from '@pkgs/observability-root-shared-ts/log';
import { spansFromDocument } from '@pkgs/observability-root-shared-ts/normalize';
import type { SimulationStep } from '@pkgs/turn-game-shared-ts/simulation';
import { type RaceState, simulationOptions } from './reference-simulation';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
});

const failingStep: SimulationStep<RaceState, number> = (
  _state,
  inputs,
  step
) => {
  throw new Error(
    `literal-race-failure:${step.tick}:${inputs[0]?.value}:${step.random()}`
  );
};

test.each([1, 256])(
  'an exported root error retains a replayable failure with %i queued inputs',
  async (count) => {
    // regression: simulation-failure-reproduction-lost-in-telemetry
    const simulation = new FixedStepSimulation<RaceState, number>(
      { distance: 0, luck: 0, inputs: [] },
      failingStep,
      { ...simulationOptions, maxQueuedInputs: 256 }
    );
    for (let index = 0; index < count; index++) {
      expect(
        simulation.enqueue({
          playerId: 'first',
          sequence: count === 1 ? 1 : 2 ** 52 + index,
          tick: 1,
          value: 4,
        }).accepted
      ).toBe(true);
    }
    let failure: unknown;
    try {
      simulation.advanceTicks(1);
    } catch (error) {
      failure = error;
    }
    if (!(failure instanceof SimulationFailure))
      throw new Error('No failure captured');
    expect(JSON.stringify(failure)).not.toContain('reproduction');
    const time = createHarnessClock();
    const batches: unknown[] = [];
    const runtime = createWorkerTelemetry({
      serviceName: 'race',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'abc',
      timers: time.timers,
      otlpUrl: 'https://collector.example/v1/traces',
      http: {
        fetch: async (_input, init) => {
          batches.push(
            JSON.parse(new TextDecoder().decode(init?.body as ArrayBuffer))
          );
          return Response.json({});
        },
      },
    });
    try {
      recordStructuredLog({
        severity: 'error',
        message: 'simulation stopped',
        loggerName: 'race',
        context: { error: failure },
      });
      await runtime.forceFlush();
      expect(batches).toHaveLength(1);
      const recorded = batches
        .flatMap(spansFromDocument)
        .find((span) => span.name === 'runtime.error');
      expect(recorded?.status).toBe('error');
      expect(recorded?.attributes['app.error.reproduction.status']).toBe(
        'available'
      );
      expect(recorded?.attributes['app.error.reproduction.format']).toBe(
        'simulation-step.v1'
      );
      const encoded = recorded?.attributes['app.error.reproduction'];
      expect(typeof encoded).toBe('string');
      if (count === 256)
        expect(
          new TextEncoder().encode(encoded as string).byteLength
        ).toBeGreaterThan(16_384);
      const saved = JSON.parse(encoded as string) as SimulationReproduction<
        RaceState,
        number
      >;
      expect(saved).toEqual(failure.reproduction);
      const replay = new FixedStepSimulation(
        saved.before.state,
        failingStep,
        saved.options
      );
      replay.restore(saved.before);
      for (const entry of saved.inputs)
        expect(replay.enqueue(entry).accepted).toBe(true);
      expect(() => replay.advanceTicks(1)).toThrow(
        (failure.cause as Error).message
      );
    } finally {
      await runtime.shutdown();
    }
  }
);
