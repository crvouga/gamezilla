import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';
import type { SimulationReplicaSample } from './simulation-replica';

const dimensions = { 'game.mode': ['room', 'matched', 'local'] } as const;
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

const frameInterval = createMetric({
  name: 'game.simulation.frame.interval',
  description: 'Spacing between presented live game frames',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const frames = createMetric({
  name: 'game.simulation.frames',
  description: 'Presented live game frames',
  unit: '{frame}',
  type: 'counter',
  dimensions,
});
const droppedFrames = createMetric({
  name: 'game.simulation.frames.dropped',
  description:
    'Presented live game frames that came later than one and a half 60 Hz frames',
  unit: '{frame}',
  type: 'counter',
  dimensions,
});
const presentationDelay = createMetric({
  name: 'game.simulation.presentation.delay',
  description: 'Authority now to the live court shown, for interpolated play',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const snapshotInterval = createMetric({
  name: 'game.simulation.snapshot.interval',
  description: 'Spacing between authoritative courts arriving at a device',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const playbackSnaps = createMetric({
  name: 'game.simulation.playback.snaps',
  description: 'Times the playback clock jumped instead of converging',
  unit: '{snap}',
  type: 'counter',
  dimensions,
});
const inputRender = createMetric({
  name: 'game.simulation.input.render.duration',
  description: 'A changed local control to the first frame showing it',
  unit: 's',
  type: 'histogram',
  dimensions,
});
const resyncs = createMetric({
  name: 'game.simulation.resyncs',
  description: 'Times a replica re-read the authority after losing it',
  unit: '{resync}',
  type: 'counter',
  dimensions,
});

/** A frame later than this missed at least one 60 Hz refresh. */
export const DROPPED_FRAME_MS = 1.5 * (1000 / 60);

export function simulationReplicaMeasures(mode: 'room' | 'matched' | 'local') {
  const attributes = { 'game.mode': mode };
  let snapsSeen = 0;
  let resyncsSeen = 0;
  return (sample: SimulationReplicaSample): void => {
    for (const milliseconds of sample.acknowledgmentMs)
      inputAcknowledgment(milliseconds / 1000, attributes);
    for (const error of sample.predictionErrors)
      predictionError(error, attributes);
    for (const milliseconds of sample.inputRenderMs)
      inputRender(milliseconds / 1000, attributes);
    snapshotAge(sample.snapshotAgeMs / 1000, attributes);
    pendingInputs(sample.pendingInputs, attributes);
    if (sample.presentationDelayMs !== null)
      presentationDelay(sample.presentationDelayMs / 1000, attributes);
    if (sample.arrivalIntervalMs !== null)
      snapshotInterval(sample.arrivalIntervalMs / 1000, attributes);
    if (sample.playbackSnaps > snapsSeen)
      playbackSnaps(sample.playbackSnaps - snapsSeen, attributes);
    snapsSeen = sample.playbackSnaps;
    if (sample.resyncs > resyncsSeen)
      resyncs(sample.resyncs - resyncsSeen, attributes);
    resyncsSeen = sample.resyncs;
    if (sample.reconciled) reconciliations(1, attributes);
  };
}

/** Frame pacing of a live game's presentation: one call per presented frame. */
export function simulationFrameMeasures(mode: 'room' | 'matched' | 'local') {
  const attributes = { 'game.mode': mode };
  return (intervalMs: number): void => {
    frameInterval(intervalMs / 1000, attributes);
    frames(1, attributes);
    if (intervalMs > DROPPED_FRAME_MS) droppedFrames(1, attributes);
  };
}

/** Histograms aggregate locally; there is no span or log for every tick. */
export function simulationMeasures(mode: 'room' | 'matched' | 'local') {
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

export function simulationFailed(mode: 'room' | 'matched' | 'local'): void {
  failed(1, { 'game.mode': mode });
}

export function simulationInputProcessingMeasures(
  mode: 'room' | 'matched' | 'local'
) {
  const attributes = { 'game.mode': mode };
  return (milliseconds: readonly number[]): void => {
    for (const sample of milliseconds)
      inputProcessing(sample / 1000, attributes);
  };
}
