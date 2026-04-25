import { Assert, ValidationError } from '@gamezilla/lib/assert';
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
import { DeterministicSimulator } from '../simulator';
import {
  CellOccupiedError,
  ClockTimeout,
  ForfeitWin,
  GameWon,
  JoinSession,
  LeaveSession,
  NotSeatedError,
  NotYourMarkError,
  PlaceMark,
  Resign,
  TickClock,
  TIC_TAC_TOE_CLOCK_MS_PER_PLAYER,
  TicTacToeModule,
  UnknownCommandError,
  WrongTurnError,
} from './fixtures/tic-tac-toe.module';
import { TestCrashHandler } from './test-crash-handler';
import { ticTacToeBoardCell } from './tic-tac-toe-board';
import { ticTacToeThreePeers } from './tictactoe-peers';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const FIX = ticTacToeThreePeers();
const PEER = {
  authority: FIX.peers.authority.peerId,
  playerX: FIX.peers.playerX.peerId,
  playerO: FIX.peers.playerO.peerId,
} as const;
const PEER_IDS = [PEER.authority, PEER.playerX, PEER.playerO];

function createSim(opts?: { timeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    topic: 'tic-tac-toe-sim',
    initialMembership: FIX.initialMembership,
    initialMemberPublicKeys: FIX.initialMemberPublicKeys,
    roomSecret: FIX.roomSecret,
    peerSecretSeeds: FIX.peerSecretSeeds,
    timeoutMs: opts?.timeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  });
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a number`);
  }
  return value;
}

describe('TicTacToe integration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('valid PLACE_MARK committed by all peers, state converges', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 4, player: 'X' }));
    sim.assertConverged();
    const state = sim.getCommittedState(PEER.playerX);
    expect(ticTacToeBoardCell(state, 4)).toBe('X');
    expect(state['currentTurn']).toBe('O');
    sim.destroy();
  });

  it('PLACE_MARK on wrong turn → rejected', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 0, player: 'O' }));
    expect(sim.getErrorLog().length).toBe(1);
    expect(WrongTurnError.is(sim.getErrorLog()[0]!)).toBe(true);
    sim.destroy();
  });

  it('PLACE_MARK on occupied cell → rejected', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 0, player: 'O' }));
    expect(sim.getErrorLog().some((e) => CellOccupiedError.is(e))).toBe(true);
    sim.destroy();
  });

  it('PLACE_MARK with cell=9 → ValidationError at tag construction', () => {
    const sim = createSim();
    expect(() =>
      sim.dispatch(PEER.playerX, PlaceMark({ cell: 9, player: 'X' }))
    ).toThrow(ValidationError);
    sim.destroy();
  });

  it('PLACE_MARK with invalid player → ValidationError in router', () => {
    const sim = createSim();
    expect(() =>
      sim.dispatch(PEER.playerX, {
        type: PlaceMark.type,
        payload: { cell: 0, player: 'Z' },
      })
    ).toThrow(ValidationError);
    sim.destroy();
  });

  it('win condition: GAME_WON event produced, state converges', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 3, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 1, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 2, player: 'X' }));

    sim.assertConverged();
    const state = sim.getCommittedState(PEER.playerX);
    expect(state['winner']).toBe('X');
    expect(state['status']).toBe('completed');

    const events = sim.getEventLog(PEER.playerX);
    expect(events.some((e) => GameWon.is(e))).toBe(true);
    sim.destroy();
  });

  it('draw condition: GAME_DRAWN event produced, state converges', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 1, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 2, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 5, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 3, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 6, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 4, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 8, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 7, player: 'X' }));

    sim.assertConverged();
    const state = sim.getCommittedState(PEER.playerX);
    expect(state['winner']).toBe('draw');
    expect(state['status']).toBe('completed');
    sim.destroy();
  });

  it('RESIGN: PLAYER_RESIGNED produced, game ends', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerO, Resign({ player: 'O' }));
    sim.assertConverged();
    const state = sim.getCommittedState(PEER.playerX);
    expect(state['winner']).toBe('X');
    expect(state['status']).toBe('completed');
    sim.destroy();
  });

  it('full game X wins — all moves committed, all peers converge', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 3, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 1, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 2, player: 'X' }));

    sim.assertConverged();
    for (const peerId of PEER_IDS) {
      const state = sim.getCommittedState(peerId);
      expect(state['winner']).toBe('X');
    }
    sim.destroy();
  });

  it('partition: Player O offline, X move commits via authority', () => {
    const sim = createSim();
    sim.disconnectPeer(PEER.playerO);
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));

    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerX), 0)).toBe('X');
    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.authority), 0)).toBe('X');
    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerO), 0)).toBeNull();
    sim.destroy();
  });

  it('reconnect after partition: Player O syncs, state converges', () => {
    const sim = createSim();
    sim.disconnectPeer(PEER.playerO);
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));

    sim.reconnectPeer(PEER.playerO);

    sim.assertConverged();
    sim.destroy();
  });

  it('timeout: authority offline, advance time, optimistic rolled back', () => {
    const sim = createSim({ timeoutMs: 5000 });

    sim.disconnectPeer(PEER.authority);

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    expect(ticTacToeBoardCell(sim.getState(PEER.playerX), 0)).toBe('X');

    sim.advanceTime(5001);
    expect(ticTacToeBoardCell(sim.getState(PEER.playerX), 0)).toBeNull();
    expect(sim.getTimeoutLog().length).toBe(1);
    sim.destroy();
  });

  it('simultaneous dispatches from different peers both resolve correctly', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 8, player: 'X' }));

    sim.assertConverged();
    const state = sim.getCommittedState(PEER.playerX);
    expect(ticTacToeBoardCell(state, 0)).toBe('X');
    expect(ticTacToeBoardCell(state, 4)).toBe('O');
    expect(ticTacToeBoardCell(state, 8)).toBe('X');
    sim.destroy();
  });

  it('unknown command type → tagged rejection, no crash', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, { type: 'UNKNOWN', payload: {} });
    expect(sim.getErrorLog().some((e) => UnknownCommandError.is(e))).toBe(true);
    sim.destroy();
  });

  it('unknown event type → state unchanged, no crash', () => {
    const sim = createSim();
    const store = sim.getStore(PEER.playerX);
    const base = store.getCommittedLogEntries();
    const maxSeq = base.reduce((m, e) => Math.max(m, e.seq), 0);
    const before = JSON.stringify(store.getCommittedState());
    store.rehydrate([
      ...base,
      { seq: maxSeq + 1, event: { type: 'UNKNOWN_EVENT', payload: {} } },
    ]);
    const after = JSON.stringify(store.getCommittedState());
    expect(after).toBe(before);
    sim.destroy();
  });

  it('offline dispatch: move made while offline is committed after reconnection', () => {
    const sim = createSim({ timeoutMs: 5000 });

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.assertConverged();
    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerX), 0)).toBe('X');

    sim.disconnectPeer(PEER.playerO);

    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }));
    expect(ticTacToeBoardCell(sim.getState(PEER.playerO), 4)).toBe('O');

    sim.reconnectPeer(PEER.playerO);

    sim.advanceTime(5001);

    expect(ticTacToeBoardCell(sim.getState(PEER.playerO), 4)).toBe('O');
    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerO), 4)).toBe('O');

    sim.destroy();
  });
});

describe('TicTacToe session seats (join / leave)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('JOIN_SESSION then PLACE_MARK enforces command.peerId vs claimed mark', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, JoinSession({ mark: 'X' }));
    sim.dispatch(PEER.playerO, JoinSession({ mark: 'O' }));
    sim.assertConverged();

    sim.dispatch(PEER.playerO, PlaceMark({ cell: 0, player: 'X' }));
    expect(sim.getErrorLog().some((e) => NotYourMarkError.is(e))).toBe(true);

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.assertConverged();
    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerX), 0)).toBe('X');
    sim.destroy();
  });

  it('LEAVE_SESSION mid-game forfeits to the remaining seated peer', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, JoinSession({ mark: 'X' }));
    sim.dispatch(PEER.playerO, JoinSession({ mark: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 4, player: 'X' }));
    sim.assertConverged();

    sim.dispatch(PEER.playerO, LeaveSession({}));
    sim.assertConverged();

    const state = sim.getCommittedState(PEER.playerX);
    expect(state['winner']).toBe('X');
    expect(state['status']).toBe('completed');
    expect(sim.getEventLog(PEER.playerX).some((e) => ForfeitWin.is(e))).toBe(
      true
    );
    sim.destroy();
  });

  it('LEAVE_SESSION without a seat → NOT_SEATED', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, LeaveSession({}));
    expect(sim.getErrorLog().some((e) => NotSeatedError.is(e))).toBe(true);
    sim.destroy();
  });
});

describe('TicTacToe chess-style clock (simulator)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function seatAndOpen(sim: DeterministicSimulator): void {
    sim.dispatch(PEER.playerX, JoinSession({ mark: 'X' }));
    sim.dispatch(PEER.playerO, JoinSession({ mark: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.assertConverged();
  }

  it('clock tick debits only active player remainder', () => {
    const sim = createSim();
    seatAndOpen(sim);

    const before = sim.getClockSnapshot(PEER.playerX);
    expect(before.clockActivePlayer).toBe('O');
    expect(before.remainingMsX).toBe(TIC_TAC_TOE_CLOCK_MS_PER_PLAYER);

    sim.dispatch(PEER.authority, TickClock({ elapsedMs: 400 }));

    const after = sim.getClockSnapshot(PEER.playerX);
    expect(after.remainingMsX).toBe(TIC_TAC_TOE_CLOCK_MS_PER_PLAYER);
    const beforeO = requireNumber(before.remainingMsO, 'before.remainingMsO');
    const afterO = requireNumber(after.remainingMsO, 'after.remainingMsO');
    expect(afterO).toBeLessThan(beforeO);
    sim.destroy();
  });

  it('after committed move, running clock switches to other player', () => {
    const sim = createSim();
    seatAndOpen(sim);
    sim.dispatch(PEER.authority, TickClock({ elapsedMs: 200 }));

    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }));
    sim.assertConverged();

    const snap = sim.getClockSnapshot(PEER.authority);
    expect(snap.clockActivePlayer).toBe('X');
    expect(sim.getCommittedState(PEER.authority)['currentTurn']).toBe('X');
    sim.destroy();
  });

  it('clock timeout completes game for opponent win', () => {
    const sim = createSim();
    seatAndOpen(sim);

    sim.dispatch(
      PEER.authority,
      TickClock({ elapsedMs: TIC_TAC_TOE_CLOCK_MS_PER_PLAYER + 500 }),
    );

    sim.assertConverged();
    expect(sim.getEventLog(PEER.playerX).some((e) => ClockTimeout.is(e))).toBe(
      true
    );
    expect(sim.getCommittedState(PEER.playerX)['winner']).toBe('X');
    expect(sim.getCommittedState(PEER.playerX)['status']).toBe('completed');
    sim.destroy();
  });

  it('disconnect / reconnect: clock state converges after sync', () => {
    const sim = createSim();
    seatAndOpen(sim);
    sim.dispatch(PEER.authority, TickClock({ elapsedMs: 300 }));

    sim.disconnectPeer(PEER.playerO);
    sim.dispatch(PEER.authority, TickClock({ elapsedMs: 200 }));
    sim.reconnectPeer(PEER.playerO);

    sim.assertConverged();
    const a = sim.getClockSnapshot(PEER.authority);
    const o = sim.getClockSnapshot(PEER.playerO);
    expect(JSON.stringify(a)).toBe(JSON.stringify(o));
    sim.destroy();
  });
});
