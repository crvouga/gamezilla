import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';

const dimensions = { 'game.mode': ['custom', 'matched', 'local'] } as const;
const tickDuration = createMetric({
  name: 'game.simulation.tick.duration',
  description: 'Fixed-step execution duration',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const tickDelay = createMetric({
  name: 'game.simulation.tick.delay',
  description: 'Scheduling delay beyond the configured tick interval',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const dropped = createMetric({
  name: 'game.simulation.ticks.dropped',
  description: 'Whole ticks dropped by bounded catch-up',
  unit: '{tick}',
  type: 'counter',
  dimensions,
});
const failed = createMetric({
  name: 'game.simulation.failures',
  description: 'Failed authoritative executions',
  unit: '{failure}',
  type: 'counter',
  dimensions,
});
const inputAcknowledgment = createMetric({
  name: 'game.simulation.input.ack.duration',
  description:
    'Client submission to authoritative acknowledgment, including snapshot cadence',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const inputProcessing = createMetric({
  name: 'game.simulation.input.processing.duration',
  description:
    'Authority receipt to successful tick application, excluding transport and snapshot wait',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const snapshotAge = createMetric({
  name: 'game.simulation.snapshot.age',
  description: 'Age since the latest valid snapshot was received',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const pendingInputs = createMetric({
  name: 'game.simulation.prediction.pending',
  description: 'Unacknowledged local projections',
  unit: '{input}',
  type: 'histogram',
  dimensions,
});
const predictionError = createMetric({
  name: 'game.simulation.prediction.error',
  description:
    'Normalized local projection error at the acknowledged logical tick',
  unit: '1',
  type: 'histogram',
  dimensions,
});
const reconciliations = createMetric({
  name: 'game.simulation.reconciliations',
  description: 'Authoritative updates reconciled by a replica',
  unit: '{update}',
  type: 'counter',
  dimensions,
});

export function simulationReplicaMeasures(
  mode: 'custom' | 'matched' | 'local'
) {
  const attributes = { 'game.mode': mode };
  return (sample: {
    snapshotAgeMs: number;
    pendingInputs: number;
    reconciled: boolean;
    acknowledgmentMs: readonly number[];
    predictionErrors: readonly number[];
  }): void => {
    for (const milliseconds of sample.acknowledgmentMs)
      inputAcknowledgment(milliseconds / 1000, attributes);
    for (const error of sample.predictionErrors)
      predictionError(error, attributes);
    snapshotAge(sample.snapshotAgeMs / 1000, attributes);
    pendingInputs(sample.pendingInputs, attributes);
    if (sample.reconciled) reconciliations(1, attributes);
  };
}

/** Histograms aggregate locally; there is no span or log for every tick. */
export function simulationMeasures(mode: 'custom' | 'matched' | 'local') {
  const attributes = { 'game.mode': mode };
  return (sample: {
    durationMs: number;
    delayMs: number;
    droppedTicks: number;
  }): void => {
    tickDuration(sample.durationMs / 1000, attributes);
    tickDelay(sample.delayMs / 1000, attributes);
    if (sample.droppedTicks > 0) dropped(sample.droppedTicks, attributes);
  };
}

export function simulationFailed(mode: 'custom' | 'matched' | 'local'): void {
  failed(1, { 'game.mode': mode });
}

export function simulationInputProcessingMeasures(
  mode: 'custom' | 'matched' | 'local'
) {
  const attributes = { 'game.mode': mode };
  return (milliseconds: readonly number[]): void => {
    for (const sample of milliseconds)
      inputProcessing(sample / 1000, attributes);
  };
}
