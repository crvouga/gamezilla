import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';

test('an offline creator uses the shared execution controller and keeps a completed bot game on return', async () => {
  const rig = await liveSessionRoom(true);
  const alice = await rig.connect('alice');
  const rules = createTurnGames([continuousRaceGame.registration]);
  rig.transports.get('alice')!.closeFromServer();
  let sequence = 0;
  const errors: unknown[] = [];
  const local = new LocalSimulationSession({
    room: alice,
    owner: 'alice',
    rules,
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error) => errors.push(error),
  });
  try {
    await local.flush();
    expect({
      errors,
      game: CustomGamesAttr.from(alice.getSnapshot()).current,
    }).toMatchObject({ errors: [], game: { execution: { generation: 1 } } });
    let epoch = '';
    let tick = -1;
    const unsubscribe = local.subscribe((message) => {
      if (!SimulationStateChanged.is(message)) return;
      epoch = message.payload.epoch;
      tick = message.payload.tick;
    });
    expect(
      local.send(RequestSimulationSnapshot({ version: 1 }))
    ).not.toBeNull();
    expect(tick).toBe(0);
    expect(
      local.send(
        SubmitSimulationInput({
          version: 1,
          epoch,
          playerId: 'white',
          sequence: 1,
          tick: 1,
          value: 4,
        })
      )
    ).not.toBeNull();
    for (let index = 0; index < 70; index++) {
      rig.clock.advance(1000 / 60);
      await local.flush();
    }
    const finished = CustomGamesAttr.from(alice.getSnapshot()).current!;
    expect(finished.status).toBe('completed');
    expect(finished.moves).toEqual([]);
    expect(finished.fen).toContain('1:white:1:4');
    expect(finished.fen).toContain(':black:');
    expect(rig.current().status).toBe('active');
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    unsubscribe();
    await rig.transports.get('alice')!.connect();
    await alice.untilSynced();
    await rig.settle();
    await local.flush();
    expect(rig.current().status).toBe('completed');
    expect(rig.current().fen).toBe(finished.fen);
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
  } finally {
    local.dispose();
    rig.dispose();
  }
});

test('two seats on one device have independent input sequences and never acquire a second human identity', async () => {
  const rig = await liveSessionRoom('players');
  const alice = await rig.connect('alice');
  rig.transports.get('alice')!.closeFromServer();
  const errors: unknown[] = [];
  const local = new LocalSimulationSession({
    room: alice,
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => 'control',
    onError: (error) => errors.push(error),
  });
  try {
    await local.flush();
    let snapshot: {
      epoch: string;
      tick: number;
      state: string;
      acknowledged: Readonly<Record<string, number>>;
    } | null = null;
    local.subscribe((message) => {
      if (SimulationStateChanged.is(message)) snapshot = message.payload;
    });
    local.send(RequestSimulationSnapshot({ version: 1 }));
    const current = () => {
      if (snapshot === null) throw new Error('snapshot missing');
      return snapshot;
    };
    for (const [side, value] of [
      ['white', 3],
      ['black', 7],
    ] as const)
      expect(
        local.send(
          SubmitSimulationInput({
            version: 1,
            epoch: current().epoch,
            playerId: side,
            sequence: 1,
            tick: 1,
            value,
          })
        )
      ).not.toBeNull();
    rig.clock.advance(50);
    await local.flush();
    local.send(RequestSimulationSnapshot({ version: 1 }));
    expect(current().tick).toBe(3);
    expect(current().acknowledged).toEqual({ black: 1, white: 1 });
    expect(current().state).toContain('1:white:1:3');
    expect(current().state).toContain('1:black:1:7');
    expect(CustomGamesAttr.from(alice.getSnapshot()).current!.black).toEqual({
      kind: 'local',
      person: '',
    });
    expect(errors).toEqual([]);
  } finally {
    local.dispose();
    rig.dispose();
  }
});

// regression: pong-local-reopen-after-paddle-guidance
test('closing a local controller saves its latest tick before the next controller opens', async () => {
  const rig = await liveSessionRoom('players');
  const alice = await rig.connect('alice');
  const errors: unknown[] = [];
  let next = 0;
  const options = {
    room: alice,
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => `local-${++next}`,
    onError: (error: unknown) => errors.push(error),
  };
  let local = new LocalSimulationSession(options);
  try {
    await local.flush();
    rig.clock.advance(50);
    await local.flush();
    local.dispose();
    await alice.flushIo();
    local = new LocalSimulationSession(options);
    await local.flush();
    const snapshots: ReturnType<typeof SimulationStateChanged>['payload'][] =
      [];
    local.subscribe((message) => {
      if (SimulationStateChanged.is(message)) snapshots.push(message.payload);
    });
    local.send(RequestSimulationSnapshot({ version: 1 }));
    expect(snapshots.at(-1)).toMatchObject({ tick: 3 });
    expect(
      JSON.parse(snapshots.at(-1)!.state.slice('race-live:'.length))
    ).toMatchObject({ distance: 50 });
    expect(errors).toEqual([]);
  } finally {
    local.dispose();
    rig.dispose();
  }
});
