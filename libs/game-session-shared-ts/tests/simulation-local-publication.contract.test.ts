import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { SimulationStateChanged } from '@libs/game-session-shared-ts/simulation-messages';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { liveSessionRoom } from './reference-live-session-room';
import { requestLocalState } from './reference-local-persistence';

class DelayedLiveStorage extends InMemoryClientStorage {
  calls = 0;
  private wait: (() => Promise<void>) | null = null;

  blockNextWrite() {
    let entered!: () => void;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.wait = () => {
      entered();
      return gate;
    };
    return { blocked, release };
  }

  override async replaceLiveCheckpoint(
    ...args: Parameters<InMemoryClientStorage['replaceLiveCheckpoint']>
  ) {
    this.calls++;
    const wait = this.wait;
    this.wait = null;
    if (wait !== null) await wait();
    return super.replaceLiveCheckpoint(...args);
  }
}

test('a slow local store holds publication and future wakes behind its pending write', async () => {
  const rig = await liveSessionRoom('players');
  const storage = new DelayedLiveStorage();
  const room = await rig.connect('alice', storage);
  rig.transports.get('alice')!.closeFromServer();
  let sequence = 0;
  const errors: unknown[] = [];
  const local = new LocalSimulationSession({
    room,
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error) => errors.push(error),
  });
  let release = () => {};
  try {
    await local.flush();
    rig.clock.advance(100);
    await local.flush();
    expect((await requestLocalState(local)).tick).toBe(6);
    const frames: number[] = [];
    const unsubscribe = local.subscribe((message) => {
      if (SimulationStateChanged.is(message)) frames.push(message.payload.tick);
    });
    const before = storage.calls;
    const gate = storage.blockNextWrite();
    release = gate.release;
    rig.clock.advance(50);
    const flushing = local.flush();
    await gate.blocked;
    expect(frames).toEqual([]);
    rig.clock.advance(10_000);
    expect(storage.calls).toBe(before + 1);
    expect(frames).toEqual([]);
    gate.release();
    await flushing;
    await local.flush();
    expect(frames[0]).toBe(9);
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
    unsubscribe();
  } finally {
    release();
    local.dispose();
    rig.dispose();
  }
});

test('a frame saved before a queued local choice cannot publish the earlier token afterwards', async () => {
  // regression: simulation-published-frame-reverts-accepted-choice
  const rig = await liveSessionRoom('players', hybridRaceGame);
  const storage = new DelayedLiveStorage();
  const room = await rig.connect('alice', storage);
  rig.transports.get('alice')!.closeFromServer();
  let sequence = 0;
  const errors: unknown[] = [];
  const local = new LocalSimulationSession({
    room,
    owner: 'alice',
    rules: createTurnGames([hybridRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error) => errors.push(error),
  });
  let release = () => {};
  try {
    await local.flush();
    rig.clock.advance(100);
    await local.flush();
    await requestLocalState(local);
    const current = () => CustomGamesAttr.from(room.getSnapshot()).current!;
    const observed: number[] = [];
    const unsubscribe = local.subscribe((message) => {
      if (SimulationStateChanged.is(message) && current().moves.length === 1)
        observed.push(timedRaceCodec.decode(message.payload.state)!.tokens);
    });
    const gate = storage.blockNextWrite();
    release = gate.release;
    rig.clock.advance(50);
    const flushing = local.flush();
    await gate.blocked;
    const chosen = local.choose({
      gameId: current().id,
      revision: current().revision,
      operation: 'move',
      uci: 'advance-token',
      ply: 0,
    });
    gate.release();
    await chosen;
    await flushing;
    await local.flush();
    await requestLocalState(local);
    expect(observed.length).toBeGreaterThan(0);
    expect(observed).not.toContain(0);
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
    unsubscribe();
  } finally {
    release();
    local.dispose();
    rig.dispose();
  }
});
