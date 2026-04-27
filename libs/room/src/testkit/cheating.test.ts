import { Assert } from '@gamezilla/lib/assert';
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
import {
  MarkPlaced,
  PlaceMark,
  TicTacToeModule,
} from './fixtures/tic-tac-toe.module';
import { DeterministicSimulator } from '../simulator';
import type { State } from '../room/types';
import { isSystemEvent } from '../events/utils';
import { ticTacToeBoardCell } from './tic-tac-toe-board';
import { TestCrashHandler } from './test-crash-handler';
import { ticTacToeThreePeers } from './tic-tac-toe-peers';
import { isPlainRecord } from '../room/security/plain-record';

const crash: Assert = Assert.crash();

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
    topic: 'cheat-test',
    initialMembership: FIX.initialMembership,
    initialMemberPublicKeys: FIX.initialMemberPublicKeys,
    roomSecret: FIX.roomSecret,
    peerSecretSeeds: FIX.peerSecretSeeds,
    timeoutMs: opts?.timeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  });
}

function cell(state: State, index: number): null | string {
  return ticTacToeBoardCell(state, index);
}

function requireFiniteSeq(state: State): number {
  const s = state['seq'];
  crash.number(s, 'state.seq must be a finite number');
  return s;
}

function wireRecord(payload: unknown): Record<string, unknown> {
  crash.record(payload, 'wire payload must be a plain object');
  return payload;
}

function tamperAcceptedEntriesInBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (body['kind'] !== 'accepted') return body;
  const entriesRaw = body['entries'];
  crash.array(entriesRaw, 'accepted.entries must be an array');
  const newEntries = entriesRaw.map((row) => {
    crash.record(row, 'log entry must be object');
    const seq = row['seq'];
    crash.number(seq, 'entry.seq must be number');
    const event = row['event'];
    crash.record(event, 'entry.event must be object');
    const type = (event as Record<string, unknown>)['type'];
    if (type !== MarkPlaced.type) return row;
    const p = (event as Record<string, unknown>)['payload'];
    crash.record(p, 'MARK_PLACED payload must be object');
    return {
      seq,
      event: {
        ...event,
        payload: { ...(p as Record<string, unknown>), cell: 8 },
      },
    };
  });
  return { ...body, entries: newEntries };
}

/** MITM: tamper signed envelope inner body (invalidates signature + bodyDigest). */
function tamperSignedAcceptedPayload(payload: unknown): unknown {
  const msg = wireRecord(payload);
  if (msg['scheme'] !== 'room-wire-v1') return payload;
  const body = msg['body'];
  if (!isPlainRecord(body)) return payload;
  return { ...msg, body: tamperAcceptedEntriesInBody(body) };
}

describe('Cheating: Authority', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fabricated commit — unsigned accepted is dropped', () => {
    const sim = createSim();

    sim.injectWireMessage({
      kind: 'accepted',
      commandId: 'fabricated-1',
      entries: [
        {
          seq: 4,
          event: MarkPlaced({ cell: 4, player: 'X', seq: 1 }),
        },
      ],
    });

    for (const peerId of PEER_IDS) {
      expect(cell(sim.getCommittedState(peerId), 4)).toBeNull();
    }
    expect(sim.getWireAuthFailures().length).toBeGreaterThan(0);
    sim.destroy();
  });

  it('identity spoofing — player-o plays as X via payload mismatch', () => {
    const sim = createSim();

    sim.dispatch(PEER.playerO, PlaceMark({ cell: 0, player: 'X' }));

    sim.assertConverged();
    expect(cell(sim.getCommittedState(PEER.authority), 0)).toBe('X');
    expect(sim.getCommittedState(PEER.authority)['currentTurn']).toBe('O');
    sim.destroy();
  });

  it('identity spoofing — forged peerId in injected propose is dropped', () => {
    const sim = createSim();

    const forged = sim.forgeCommand(
      PEER.playerO,
      PlaceMark({ cell: 0, player: 'X' }),
      { fakePeerId: PEER.playerX },
    );
    sim.injectWireMessage({ kind: 'propose', command: forged });

    expect(cell(sim.getCommittedState(PEER.authority), 0)).toBeNull();
    expect(sim.getWireAuthFailures().length).toBeGreaterThan(0);
    sim.destroy();
  });

  it('event tampering (MITM) — tampered signed accepted is dropped (no fork)', () => {
    const sim = createSim();

    sim.setMessageInterceptor((_topic, payload) =>
      tamperSignedAcceptedPayload(payload),
    );

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));

    expect(cell(sim.getCommittedState(PEER.authority), 0)).toBe('X');
    expect(cell(sim.getCommittedState(PEER.authority), 8)).toBeNull();

    /* Followers drop corrupted wire; authority already applied locally before publish. */
    expect(cell(sim.getCommittedState(PEER.playerX), 8)).toBeNull();
    expect(cell(sim.getCommittedState(PEER.playerX), 0)).toBeNull();

    sim.setMessageInterceptor(null);
    sim.destroy();
  });

  it('replay with same commandId — finalized set prevents double-commit', () => {
    const sim = createSim();

    let captured: unknown = null;
    sim.setMessageInterceptor((_topic, payload) => {
      const msg = wireRecord(payload);
      if (msg['scheme'] === 'room-wire-v1') {
        const body = msg['body'];
        if (isPlainRecord(body) && body['kind'] === 'accepted' && !captured) {
          captured = structuredClone(payload);
        }
      }
      return payload;
    });

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.assertConverged();
    sim.setMessageInterceptor(null);

    const stateBefore = JSON.stringify(sim.getCommittedState(PEER.playerO));
    sim.injectWireMessage(captured);
    const stateAfter = JSON.stringify(sim.getCommittedState(PEER.playerO));

    expect(stateAfter).toBe(stateBefore);
    sim.destroy();
  });

  it('replay with new commandId — unsigned forged accepted is dropped', () => {
    const sim = createSim();

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.assertConverged();

    const eventCountBefore = sim.getEventLog(PEER.playerO).length;
    const domain = sim
      .getCommittedLogEntries(PEER.authority)
      .filter((e) => !isSystemEvent(e.event));
    const start = sim.getLatestSeq(PEER.authority) + 1;
    const replayEntries = domain.map((e, i) => ({
      seq: start + i,
      event: e.event,
    }));

    sim.injectWireMessage({
      kind: 'accepted',
      commandId: 'replayed-new-id',
      entries: replayEntries,
    });

    const eventCountAfter = sim.getEventLog(PEER.playerO).length;
    expect(eventCountAfter).toBe(eventCountBefore);
    sim.destroy();
  });

  it('out-of-turn via injected propose — authority rejects, board unchanged', () => {
    const sim = createSim();

    const boardBefore = JSON.stringify(
      sim.getCommittedState(PEER.authority)['board'],
    );

    const forged = sim.forgeCommand(
      PEER.playerO,
      PlaceMark({ cell: 0, player: 'O' }),
    );
    sim.injectWireMessage({ kind: 'propose', command: forged });

    const boardAfter = JSON.stringify(sim.getCommittedState(PEER.authority)['board']);
    expect(boardAfter).toBe(boardBefore);
    sim.destroy();
  });

  it('double propose — unsigned duplicate inject does not advance seq', () => {
    const sim = createSim();

    const cmd = sim.forgeCommand(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    expect(cell(sim.getCommittedState(PEER.authority), 0)).toBe('X');

    const seqBefore = requireFiniteSeq(sim.getCommittedState(PEER.authority));
    sim.injectWireMessage({ kind: 'propose', command: cmd });
    const seqAfter = requireFiniteSeq(sim.getCommittedState(PEER.authority));

    expect(seqAfter).toBe(seqBefore);
    sim.destroy();
  });

  it('unknown message kind — unsigned junk ignored', () => {
    const sim = createSim();

    const stateBefore = JSON.stringify(sim.getCommittedState(PEER.authority));

    sim.injectWireMessage({ kind: 'totally_bogus', data: 'garbage' });

    const stateAfter = JSON.stringify(sim.getCommittedState(PEER.authority));
    expect(stateAfter).toBe(stateBefore);
    sim.destroy();
  });
});

describe('Cheating: Cross-cutting', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('flood attack — rapid-fire dispatches, no crash', () => {
    const sim = createSim();

    for (let i = 0; i < 50; i++) {
      try {
        sim.dispatch(
          PEER.playerX,
          PlaceMark({
            cell: i % 9,
            player: (i % 2 === 0 ? 'X' : 'O') as 'X' | 'O',
          }),
        );
      } catch {
        // dispatch may throw for invalid moves — that's fine
      }
    }

    const state = sim.getCommittedState(PEER.authority);
    expect(state['board']).toBeDefined();
    expect(state['status']).toBeDefined();
    sim.destroy();
  });

  it('disconnect + cheat — unsigned inject does not apply while peer offline', () => {
    const sim = createSim();

    sim.disconnectPeer(PEER.playerO);

    sim.injectWireMessage({
      kind: 'accepted',
      commandId: 'offline-cheat-1',
      entries: [
        {
          seq: 4,
          event: MarkPlaced({ cell: 0, player: 'X', seq: 1 }),
        },
      ],
    });

    expect(cell(sim.getCommittedState(PEER.authority), 0)).toBeNull();
    expect(cell(sim.getCommittedState(PEER.playerO), 0)).toBeNull();

    sim.reconnectPeer(PEER.playerO);

    expect(cell(sim.getCommittedState(PEER.playerO), 0)).toBeNull();
    sim.destroy();
  });

  it('interceptor drop all — causes timeout on pending commands', () => {
    const sim = createSim({ timeoutMs: 3000 });

    sim.setMessageInterceptor(() => null);

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 4, player: 'X' }));

    expect(cell(sim.getState(PEER.playerX), 4)).toBe('X');
    expect(cell(sim.getCommittedState(PEER.playerX), 4)).toBeNull();

    sim.advanceTime(3001);

    expect(cell(sim.getState(PEER.playerX), 4)).toBeNull();
    expect(sim.getTimeoutLog().length).toBe(1);

    sim.setMessageInterceptor(null);
    sim.destroy();
  });

  it('convergence after cheating — honest peers converge after junk injection', () => {
    const sim = createSim();

    sim.injectWireMessage({ kind: 'totally_bogus', data: [1, 2, 3] });
    sim.injectWireMessage({ kind: 'unknown', commandId: 'fake' });

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }));
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 3, player: 'O' }));
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 1, player: 'X' }));

    sim.assertConverged();

    const auth = sim.getCommittedState(PEER.authority);
    expect(cell(auth, 0)).toBe('X');
    expect(cell(auth, 3)).toBe('O');
    expect(cell(auth, 1)).toBe('X');
    sim.destroy();
  });

  it('forgeCommand utility — produces command with overridden fields', () => {
    const sim = createSim();

    const cmd = sim.forgeCommand(
      PEER.playerX,
      PlaceMark({ cell: 0, player: 'X' }),
      { id: 'custom-id', seq: 42, fakePeerId: 'hacker' },
    );

    expect(cmd.id).toBe('custom-id');
    expect(cmd.seq).toBe(42);
    expect(cmd.peerId).toBe('hacker');
    expect(PlaceMark.is(cmd.message)).toBe(true);
    sim.destroy();
  });
});
