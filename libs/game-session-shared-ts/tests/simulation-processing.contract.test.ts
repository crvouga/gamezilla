import { expect, test } from 'bun:test';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import {
  type RaceState,
  raceStep,
  simulationOptions,
} from './reference-simulation';
import { simulationRoom } from './reference-simulation-room';

const input = (sequence: number, tick: number, epoch = 'race-round-1') =>
  SubmitSimulationInput({
    version: 1,
    epoch,
    playerId: 'first',
    sequence,
    tick,
    value: 4,
  });

test('authority ingress is measured at application before the next snapshot is due', async () => {
  // regression: simulation-input-processing-latency-unreported
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    rig.clock.advance(7);
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: 'race-round-1',
        playerId: 'first',
        sequence: 1,
        tick: 1,
        value: 4,
      })
    );
    await rig.transports.get('alice')!.flush();
    expect(rig.processingMs).toEqual([]);
    rig.clock.advance(10);
    expect(rig.simulation.snapshot().tick).toBe(1);
    expect(rig.processingMs).toEqual([10]);
    rig.clock.advance(100);
    expect(rig.processingMs).toEqual([10]);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('reordered receipts are measured once from their first accepted receipt', async () => {
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    alice.sendSignal(input(2, 1));
    await rig.transports.get('alice')!.flush();
    rig.clock.advance(7);
    alice.sendSignal(input(1, 1));
    alice.sendSignal(input(2, 1));
    await rig.transports.get('alice')!.flush();
    rig.clock.advance(10);
    expect(rig.processingMs).toEqual([10, 17]);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('catch-up does not count a later queued input discarded by a higher applied sequence', async () => {
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    alice.sendSignal(input(1, 3));
    alice.sendSignal(input(2, 1));
    await rig.transports.get('alice')!.flush();
    rig.clock.advance(50);
    expect(rig.simulation.snapshot().tick).toBe(3);
    expect(rig.simulation.snapshot().acknowledged).toEqual({ first: 2 });
    expect(rig.processingMs).toEqual([50]);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test.each(['pause', 'epoch'] as const)(
  '%s clears old receipt times before a sequence is reused',
  async (fence) => {
    const rig = await simulationRoom();
    try {
      const alice = await rig.connect('alice');
      alice.sendSignal(input(1, 2));
      await rig.transports.get('alice')!.flush();
      rig.clock.advance(7);
      if (fence === 'pause') {
        rig.authority.setPaused(true);
        rig.authority.setPaused(false);
      } else rig.authority.resetInputEpoch('race-round-2');
      alice.sendSignal(
        input(1, 1, fence === 'epoch' ? 'race-round-2' : 'race-round-1')
      );
      await rig.transports.get('alice')!.flush();
      rig.clock.advance(17);
      expect(rig.processingMs).toEqual([17]);
      expect(rig.errors).toEqual([]);
    } finally {
      rig.dispose();
    }
  }
);

test('a failed mechanics tick emits no processing sample and detaches the failed authority', async () => {
  let fail = true;
  const simulation = new FixedStepSimulation<RaceState, number>(
    { distance: 0, luck: 0, inputs: [] },
    (state, inputs, context) => {
      if (fail) throw new Error('mechanics stopped');
      return raceStep(state, inputs, context);
    },
    simulationOptions
  );
  const rig = await simulationRoom(simulation);
  try {
    const alice = await rig.connect('alice');
    alice.sendSignal(input(1, 1));
    await rig.transports.get('alice')!.flush();
    rig.clock.advance(17);
    expect(rig.processingMs).toEqual([]);
    expect(rig.errors).toHaveLength(1);
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    fail = false;
    simulation.advanceTicks(1);
    expect(rig.processingMs).toEqual([]);
  } finally {
    rig.dispose();
  }
});
