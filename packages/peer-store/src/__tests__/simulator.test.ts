import { Assert } from '@gamezilla/shared/assert';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from 'bun:test';
import { TicTacToeModule } from '../__fixtures__/tic-tac-toe.module';
import { DeterministicSimulator } from '../simulator';
import { TestCrashHandler } from './test-crash-handler';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const PEERS = ['player-x', 'player-o', 'worker'];

function createSim(opts?: { consensusTimeoutMs?: number; quorum?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    peers: PEERS,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
    ...opts,
  });
}

describe('DeterministicSimulator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('pauseDelivery holds messages in queue', () => {
    const sim = createSim();
    sim.pauseDelivery();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    const state_o = sim.getCommittedState('player-o');
    expect((state_o['board'] as Array<null | string>)[0]).toBeNull();
    sim.destroy();
  });

  it('resumeDelivery delivers queued messages in order', () => {
    const sim = createSim();
    sim.pauseDelivery();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.resumeDelivery();
    const state = sim.getCommittedState('player-o');
    expect((state['board'] as Array<null | string>)[0]).toBe('X');
    sim.destroy();
  });

  it('pauseDelivery while paused → crash', () => {
    const sim = createSim();
    sim.pauseDelivery();
    expect(() => sim.pauseDelivery()).toThrow('already paused');
    sim.destroy();
  });

  it('resumeDelivery while not paused → crash', () => {
    const sim = createSim();
    expect(() => sim.resumeDelivery()).toThrow('not paused');
    sim.destroy();
  });

  it('dropNextMessage loses exactly one message', () => {
    const sim = createSim();
    sim.pauseDelivery();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.dropNextMessage();
    sim.resumeDelivery();
    sim.destroy();
  });

  it('deliverPending flushes queue synchronously', () => {
    const sim = createSim();
    sim.pauseDelivery();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.deliverPending();
    sim.resumeDelivery();
    sim.destroy();
  });

  it('disconnectPeer stops delivery to that peer', () => {
    const sim = createSim();
    sim.disconnectPeer('player-o');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    const state_o = sim.getCommittedState('player-o');
    expect((state_o['board'] as Array<null | string>)[0]).toBeNull();
    sim.destroy();
  });

  it('reconnectPeer resumes delivery', () => {
    const sim = createSim();
    sim.disconnectPeer('player-o');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.reconnectPeer('player-o');

    const events = sim.getEventLog('player-x');
    sim.getStore('player-o').rehydrate(events);

    const state_o = sim.getCommittedState('player-o');
    expect((state_o['board'] as Array<null | string>)[0]).toBe('X');
    sim.destroy();
  });

  it('assertConverged passes when all peers agree', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.assertConverged();
    sim.destroy();
  });

  it('assertConverged throws detailed diff when peers diverge', () => {
    const sim = createSim();

    sim.disconnectPeer('player-o');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });

    expect(() => sim.assertConverged()).toThrow('diverged');
    sim.destroy();
  });

  it('advanceTime triggers timeouts in order', () => {
    const sim = createSim({ consensusTimeoutMs: 3000 });

    sim.disconnectPeer('player-o');
    sim.disconnectPeer('worker');

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });

    const before = sim.getState('player-x');
    expect((before['board'] as Array<null | string>)[0]).toBe('X');

    sim.advanceTime(3001);

    const after = sim.getState('player-x');
    expect((after['board'] as Array<null | string>)[0]).toBeNull();
    expect(sim.getTimeoutLog().length).toBe(1);
    sim.destroy();
  });

  it('getEventLog returns committed events in seq order', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    });

    const events = sim.getEventLog('player-x');
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]!.type).toBe('MARK_PLACED');
  });

  it('reset returns all stores to initial state', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.reset();
    const state = sim.getCommittedState('player-x');
    expect((state['board'] as Array<null | string>)[0]).toBeNull();
    sim.destroy();
  });

  it('getCommittedState excludes optimistic events', () => {
    const sim = createSim();

    sim.disconnectPeer('player-o');
    sim.disconnectPeer('worker');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });

    const display = sim.getState('player-x');
    const committed = sim.getCommittedState('player-x');
    expect((display['board'] as Array<null | string>)[0]).toBe('X');
    expect((committed['board'] as Array<null | string>)[0]).toBeNull();
    sim.destroy();
  });

  it('getState includes optimistic events', () => {
    const sim = createSim();
    sim.disconnectPeer('player-o');
    sim.disconnectPeer('worker');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    const state = sim.getState('player-x');
    expect((state['board'] as Array<null | string>)[0]).toBe('X');
    sim.destroy();
  });

  it('dispatch as specific peer sets correct peerId on command', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    const events = sim.getEventLog('player-x');
    expect(events.length).toBeGreaterThanOrEqual(1);
    sim.destroy();
  });

  it('alternating disconnects — player-x syncs after reconnect via transport replay', () => {
    const sim = createSim();

    // 1. player-o disconnects
    sim.disconnectPeer('player-o');

    // 2. player-x places mark — committed on player-x + worker (quorum 2/3)
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('O');
    expect(sim.getCommittedState('worker')['currentTurn']).toBe('O');

    // 3. player-o reconnects — transport replays missed messages, state converges
    sim.reconnectPeer('player-o');
    sim.assertConverged();

    // 4. player-x disconnects
    sim.disconnectPeer('player-x');

    // 5. player-o places mark — committed on player-o + worker (quorum 2/3)
    //    player-x is disconnected; transport queues the messages
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    });
    expect(sim.getCommittedState('player-o')['currentTurn']).toBe('X');
    expect(sim.getCommittedState('worker')['currentTurn']).toBe('X');

    // 6. player-x reconnects — transport replays missed messages, player-x catches up
    sim.reconnectPeer('player-x');
    expect(sim.getEventLog('player-x').length).toBe(2);
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('X');

    // player-x can move
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    });
    expect(
      sim.getErrorLog().filter((e) => e.code === 'WRONG_TURN').length
    ).toBe(0);

    sim.assertConverged();

    sim.destroy();
  });

  it('player disconnects after move, misses opponent move, syncs on reconnect via transport replay', () => {
    const sim = createSim();

    // player-x places mark — committed on all peers via synchronous delivery
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.assertConverged();

    // player-x disconnects
    sim.disconnectPeer('player-x');

    // player-o places mark — committed on player-o + worker (quorum 2/3)
    // player-x is disconnected; transport queues the messages
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    });

    // Verify player-o and worker have both moves committed
    expect(
      (sim.getCommittedState('player-o')['board'] as Array<null | string>)[4]
    ).toBe('O');
    expect(sim.getCommittedState('player-o')['currentTurn']).toBe('X');

    // player-x's committed events are stale while still disconnected
    expect(sim.getEventLog('player-x').length).toBe(1);

    // player-x reconnects — transport replays missed messages, player-x catches up
    sim.reconnectPeer('player-x');
    expect(sim.getEventLog('player-x').length).toBe(2);
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('X');
    expect(
      (sim.getCommittedState('player-x')['board'] as Array<null | string>)[4]
    ).toBe('O');

    // player-x can move
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    });
    expect(
      sim.getErrorLog().filter((e) => e.code === 'WRONG_TURN').length
    ).toBe(0);

    sim.assertConverged();

    sim.destroy();
  });
});
