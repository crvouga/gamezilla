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
import { PeerStore } from '../peer-store';
import { ServerAuthority } from '../server-authority';
import { DeterministicSimulator } from '../simulator';
import { InMemoryBus, InMemoryTransport } from '../transport';
import type { State } from '../types';
import { TestCrashHandler } from './test-crash-handler';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const PEERS = ['player-x', 'player-o', 'server'];

function createSim(opts?: { consensusTimeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    peers: PEERS,
    consensusTimeoutMs: opts?.consensusTimeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
    syncPolicy: 'server',
    createAuthority: ({ peerId }) =>
      new ServerAuthority({ peerId, serverId: 'server' }),
  });
}

function board(state: State): Array<null | string> {
  return state['board'] as Array<null | string>;
}

describe('ServerAuthority', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('client dispatch → server commits → all peers converge', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    });
    sim.assertConverged();
    expect(board(sim.getCommittedState('player-x'))[4]).toBe('X');
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('O');
    sim.destroy();
  });

  it('server dispatch → commits locally and broadcasts', () => {
    const sim = createSim();
    sim.dispatch('server', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.assertConverged();
    expect(board(sim.getCommittedState('server'))[0]).toBe('X');
    sim.destroy();
  });

  it('invalid command → server rejects → client error', () => {
    const sim = createSim();
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    });
    expect(sim.getErrorLog().some((e) => e.code === 'WRONG_TURN')).toBe(true);
    sim.destroy();
  });

  it('full game through server authority, X wins', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 3, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 2, player: 'X' },
    });

    sim.assertConverged();
    for (const peerId of PEERS) {
      expect(sim.getCommittedState(peerId)['winner']).toBe('X');
      expect(sim.getCommittedState(peerId)['status']).toBe('completed');
    }
    sim.destroy();
  });

  it('client offline → reconnects → syncs from server', () => {
    const sim = createSim();

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.assertConverged();

    sim.disconnectPeer('player-o');

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    });

    expect(board(sim.getCommittedState('player-o'))[4]).toBeNull();

    sim.reconnectPeer('player-o');

    expect(board(sim.getCommittedState('player-o'))[0]).toBe('X');

    sim.destroy();
  });

  it('server offline → client times out → server reconnects → commit arrives', () => {
    const sim = createSim({ consensusTimeoutMs: 3000 });

    sim.disconnectPeer('server');

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });

    expect(board(sim.getState('player-x'))[0]).toBe('X');
    expect(board(sim.getCommittedState('player-x'))[0]).toBeNull();

    sim.advanceTime(3001);
    expect(board(sim.getState('player-x'))[0]).toBeNull();
    expect(sim.getTimeoutLog().length).toBe(1);

    sim.reconnectPeer('server');

    expect(board(sim.getCommittedState('server'))[0]).toBe('X');
    expect(board(sim.getCommittedState('player-x'))[0]).toBe('X');
    sim.destroy();
  });

  it('occupied cell → server rejects', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    });
    expect(sim.getErrorLog().some((e) => e.code === 'CELL_OCCUPIED')).toBe(
      true
    );
    sim.destroy();
  });

  it('resign via server authority', () => {
    const sim = createSim();
    sim.dispatch('player-o', { type: 'RESIGN', payload: { player: 'O' } });
    sim.assertConverged();
    expect(sim.getCommittedState('server')['winner']).toBe('X');
    expect(sim.getCommittedState('server')['status']).toBe('completed');
    sim.destroy();
  });

  it('two-peer setup: one client + server', () => {
    const bus = new InMemoryBus();
    const t_client = new InMemoryTransport(bus, 'client');
    const t_server = new InMemoryTransport(bus, 'server');

    const a_client = new ServerAuthority({
      peerId: 'client',
      serverId: 'server',
    });
    const a_server = new ServerAuthority({
      peerId: 'server',
      serverId: 'server',
    });

    const errors: Array<{ code: string; message: string }> = [];

    const store_client = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'client',
        peers: ['client', 'server'],
        transport: t_client,
        authority: a_client,
        consensusTimeoutMs: 5000,
      },
      { onError: (e) => errors.push(e) }
    );
    const store_server = new PeerStore(TicTacToeModule, {
      peerId: 'server',
      peers: ['client', 'server'],
      transport: t_server,
      authority: a_server,
    });

    store_client.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    });

    expect(board(store_client.getCommittedState())[4]).toBe('X');
    expect(board(store_server.getCommittedState())[4]).toBe('X');

    store_client.destroy();
    store_server.destroy();
    t_client.destroy();
    t_server.destroy();
    bus.destroy();
  });

  it('draw game via server authority', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 2, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 5, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 3, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 6, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 8, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 7, player: 'X' },
    });

    sim.assertConverged();
    for (const peerId of PEERS) {
      expect(sim.getCommittedState(peerId)['winner']).toBe('draw');
    }
    sim.destroy();
  });
});
