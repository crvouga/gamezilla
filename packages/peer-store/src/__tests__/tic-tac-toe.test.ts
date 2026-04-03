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
import type { State } from '../types';
import { TestCrashHandler } from './test-crash-handler';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const PEERS = ['player-x', 'player-o', 'worker'];

function createSim(opts?: { consensusTimeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    peers: PEERS,
    consensusTimeoutMs: opts?.consensusTimeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  });
}

function board(state: State): Array<null | string> {
  return state['board'] as Array<null | string>;
}

describe('TicTacToe integration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('valid PLACE_MARK committed by all 3 peers, state converges', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    });
    sim.assertConverged();
    const state = sim.getCommittedState('player-x');
    expect(board(state)[4]).toBe('X');
    expect(state['currentTurn']).toBe('O');
    sim.destroy();
  });

  it('PLACE_MARK on wrong turn → rejected by all peers', () => {
    const sim = createSim();
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    });
    expect(sim.getErrorLog().length).toBe(1);
    expect(sim.getErrorLog()[0]!.code).toBe('WRONG_TURN');
    sim.destroy();
  });

  it('PLACE_MARK on occupied cell → rejected by all peers', () => {
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

  it('PLACE_MARK with cell=9 → StoreError at validation', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 9, player: 'X' },
    });
    expect(sim.getErrorLog().some((e) => e.code === 'INVALID_CELL')).toBe(true);
    sim.destroy();
  });

  it('PLACE_MARK with invalid player → StoreError at validation', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'Z' },
    });
    expect(sim.getErrorLog().some((e) => e.code === 'INVALID_PLAYER')).toBe(
      true
    );
    sim.destroy();
  });

  it('win condition: GAME_WON event produced, state converges', () => {
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
    const state = sim.getCommittedState('player-x');
    expect(state['winner']).toBe('X');
    expect(state['status']).toBe('completed');

    const events = sim.getEventLog('player-x');
    expect(events.some((e) => e.type === 'GAME_WON')).toBe(true);
    sim.destroy();
  });

  it('draw condition: GAME_DRAWN event produced, state converges', () => {
    const sim = createSim();
    // X O X
    // X X O
    // O X O
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
    const state = sim.getCommittedState('player-x');
    expect(state['winner']).toBe('draw');
    expect(state['status']).toBe('completed');

    const events = sim.getEventLog('player-x');
    expect(events.some((e) => e.type === 'GAME_DRAWN')).toBe(true);
    sim.destroy();
  });

  it('RESIGN: PLAYER_RESIGNED produced, game ends', () => {
    const sim = createSim();
    sim.dispatch('player-o', { type: 'RESIGN', payload: { player: 'O' } });
    sim.assertConverged();
    const state = sim.getCommittedState('player-x');
    expect(state['winner']).toBe('X');
    expect(state['status']).toBe('completed');
    sim.destroy();
  });

  it('full game X wins — all moves committed, all peers converge', () => {
    const sim = createSim();
    // X wins with top row
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
      const state = sim.getCommittedState(peerId);
      expect(state['winner']).toBe('X');
    }
    sim.destroy();
  });

  it('full game draw — all 9 moves committed, all peers converge', () => {
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

  it('partition: Player O offline, X move commits via worker (2 of 3)', () => {
    const sim = createSim();
    sim.disconnectPeer('player-o');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });

    expect(board(sim.getCommittedState('player-x'))[0]).toBe('X');
    expect(board(sim.getCommittedState('worker'))[0]).toBe('X');
    expect(board(sim.getCommittedState('player-o'))[0]).toBeNull();
    sim.destroy();
  });

  it('reconnect after partition: Player O rehydrates, state converges', () => {
    const sim = createSim();
    sim.disconnectPeer('player-o');
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });

    sim.reconnectPeer('player-o');
    const events = sim.getEventLog('player-x');
    sim.getStore('player-o').rehydrate(events);

    sim.assertConverged();
    sim.destroy();
  });

  it('timeout: delivery paused, advance 5001ms, optimistic rolled back', () => {
    const sim = createSim({ consensusTimeoutMs: 5000 });

    sim.disconnectPeer('player-o');
    sim.disconnectPeer('worker');

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    expect(board(sim.getState('player-x'))[0]).toBe('X');

    sim.advanceTime(5001);
    expect(board(sim.getState('player-x'))[0]).toBeNull();
    expect(sim.getTimeoutLog().length).toBe(1);
    sim.destroy();
  });

  it('simultaneous dispatches from different peers both resolve correctly', () => {
    const sim = createSim();
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    });
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 8, player: 'X' },
    });

    sim.assertConverged();
    const state = sim.getCommittedState('player-x');
    expect(board(state)[0]).toBe('X');
    expect(board(state)[4]).toBe('O');
    expect(board(state)[8]).toBe('X');
    sim.destroy();
  });

  it('unknown command type → StoreError, no crash', () => {
    const sim = createSim();
    sim.dispatch('player-x', { type: 'UNKNOWN', payload: {} });
    expect(sim.getErrorLog().some((e) => e.code === 'UNKNOWN_COMMAND')).toBe(
      true
    );
    sim.destroy();
  });

  it('unknown event type → state unchanged, no crash', () => {
    const sim = createSim();
    const store = sim.getStore('player-x');
    const before = JSON.stringify(store.getCommittedState());
    store.rehydrate([{ type: 'UNKNOWN_EVENT', payload: {} }]);
    const after = JSON.stringify(store.getCommittedState());
    expect(after).toBe(before);
    sim.destroy();
  });

  it('offline dispatch: move made while offline is committed after reconnection', () => {
    const sim = createSim({ consensusTimeoutMs: 5000 });

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    });
    sim.assertConverged();
    expect(board(sim.getCommittedState('player-x'))[0]).toBe('X');

    sim.disconnectPeer('player-o');

    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    });

    expect(board(sim.getState('player-o'))[4]).toBe('O');

    sim.reconnectPeer('player-o');

    sim.advanceTime(5001);

    expect(board(sim.getState('player-o'))[4]).toBe('O');
    expect(board(sim.getCommittedState('player-o'))[4]).toBe('O');

    sim.destroy();
  });
});
