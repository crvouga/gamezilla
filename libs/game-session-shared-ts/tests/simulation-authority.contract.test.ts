import { expect, test } from 'bun:test';
import { withSimulationBots } from '@libs/game-session-shared-ts/simulation-bots';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { raceStep, simulationOptions } from './reference-simulation';
import {
  parseRaceInput,
  requestState,
  simulationRoom,
} from './reference-simulation-room';

const input = (
  playerId: string,
  sequence: number,
  tick: number,
  value: unknown = 4
) =>
  SubmitSimulationInput({
    version: 1,
    epoch: 'race-round-1',
    playerId,
    sequence,
    tick,
    value,
  });

test('real room transport delivers authoritative tick/state/acks to players and a late spectator without logging ticks', async () => {
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    const bob = await rig.connect('bob');
    alice.sendSignal(input('first', 1, 1));
    bob.sendSignal(input('second', 1, 1, 7));
    await requestState(alice);
    await requestState(bob);
    rig.clock.advance(50);
    const spectator = await rig.connect('eve');
    const state = await requestState(spectator);
    expect(state.tick).toBe(3);
    expect(state.acknowledged).toEqual({ first: 1, second: 1 });
    expect(state.state).toBe(JSON.stringify(rig.simulation.snapshot().state));
    expect(rig.simulation.snapshot().state.inputs).toEqual([
      '1:first:1:4',
      '1:second:1:7',
    ]);
    expect(await rig.storage.loadEventsAfter('race:1', 0)).toHaveLength(0);
    expect(alice.getLog()).toHaveLength(0);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
  expect(rig.clock.pendingOneShotCount()).toBe(0);
});

test('spectators, another seat, stale rounds and malformed controls never enter the authoritative mailbox', async () => {
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    const eve = await rig.connect('eve');
    eve.sendSignal(input('first', 1, 1));
    alice.sendSignal(input('second', 1, 1));
    alice.sendSignal(input('first', 1, 1, 100));
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: 'race-round-0',
        playerId: 'first',
        sequence: 1,
        tick: 1,
        value: 4,
      })
    );
    await requestState(alice);
    await requestState(eve);
    rig.clock.advance(50);
    expect(rig.simulation.snapshot().state.inputs).toEqual([]);
    expect(rig.errors).toHaveLength(4);
    expect(rig.processingMs).toEqual([]);
    expect(await rig.storage.loadEventsAfter('race:1', 0)).toHaveLength(0);
  } finally {
    rig.dispose();
  }
});

test('duplicate and reordered input packets apply once in stable player/sequence order', async () => {
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    alice.sendSignal(input('first', 2, 1, 8));
    alice.sendSignal(input('first', 1, 1, 3));
    alice.sendSignal(input('first', 2, 1, 8));
    await requestState(alice);
    rig.clock.advance(50);
    expect(rig.simulation.snapshot().state.inputs).toEqual([
      '1:first:1:3',
      '1:first:2:8',
    ]);
    expect((await requestState(alice)).acknowledged).toEqual({ first: 2 });
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('interrupting execution clears queued controls and paused wall time never becomes catch-up work', async () => {
  const rig = await simulationRoom();
  try {
    const alice = await rig.connect('alice');
    alice.sendSignal(input('first', 1, 1));
    await requestState(alice);
    rig.authority.setPaused(true);
    rig.clock.advance(60_000);
    rig.authority.setPaused(false);
    rig.clock.advance(1000 / 60);
    expect(rig.simulation.snapshot().state.inputs).toEqual([]);
    expect(rig.simulation.snapshot().tick).toBe(1);
    expect((await requestState(alice)).paused).toBe(false);
  } finally {
    rig.dispose();
  }
});

test('headless bots use bounded valid inputs and do not impersonate a person', () => {
  const step = withSimulationBots(
    raceStep,
    [
      {
        playerId: 'automaton',
        input: (_state, context) => Math.floor(context.random() * 100),
      },
    ],
    parseRaceInput
  );
  const simulation = new FixedStepSimulation(
    { distance: 0, luck: 0, inputs: [] } as Parameters<typeof raceStep>[0],
    step,
    simulationOptions
  );
  simulation.advanceTicks(3);
  const inputs = simulation.snapshot().state.inputs;
  expect(inputs).toHaveLength(3);
  expect(inputs.every((value) => value.includes(':automaton:'))).toBe(true);
  expect(simulation.snapshot().acknowledged).toEqual({});
  const broken = withSimulationBots(
    raceStep,
    [{ playerId: 'automaton', input: () => 100 }],
    parseRaceInput
  );
  expect(() =>
    new FixedStepSimulation(
      simulation.snapshot().state,
      broken,
      simulationOptions
    ).advanceTicks(1)
  ).toThrow('invalid input');
});
