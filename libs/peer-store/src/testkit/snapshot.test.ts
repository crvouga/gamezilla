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
import { PlaceMark, TicTacToeModule } from './fixtures/tic-tac-toe.module';
import { DeterministicSimulator } from '../simulator';
import { TestCrashHandler } from './test-crash-handler';
import { ticTacToeBoardCell } from './tic-tac-toe-board';
import { testPeerForLabel, ticTacToeThreePeers } from './tic-tac-toe-peers';
import { membershipToRecord, rebuildMembershipFromLog } from '../store/membership';

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

describe('Snapshot and incremental sync', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('authority retains full committed log for domain moves', () => {
    const sim = new DeterministicSimulator(TicTacToeModule, {
      topic: 'snapshot-test',
      initialMembership: { ...FIX.initialMembership },
      initialMemberPublicKeys: FIX.initialMemberPublicKeys,
      roomSecret: FIX.roomSecret,
      peerSecretSeeds: FIX.peerSecretSeeds,
      advanceTime: (ms) => jest.advanceTimersByTime(ms),
    });

    sim.dispatch(PEER.authority, PlaceMark({ cell: 4, player: 'X' }));
    sim.deliverPending();

    expect(sim.getCommittedLogEntries(PEER.authority).length).toBe(4);
    expect(sim.getLatestSeq(PEER.authority)).toBe(4);

    sim.destroy();
  });

  it('late joiner syncs after authority has moved', () => {
    const sim = new DeterministicSimulator(TicTacToeModule, {
      topic: 'snapshot-join',
      initialMembership: { ...FIX.initialMembership },
      initialMemberPublicKeys: FIX.initialMemberPublicKeys,
      roomSecret: FIX.roomSecret,
      peerSecretSeeds: FIX.peerSecretSeeds,
      advanceTime: (ms) => jest.advanceTimersByTime(ms),
    });

    sim.dispatch(PEER.authority, PlaceMark({ cell: 4, player: 'X' }));
    sim.deliverPending();

    sim.joinPeer('late', 1);
    sim.deliverPending();

    const lateId = testPeerForLabel('late').peerId;
    const membership = membershipToRecord(
      rebuildMembershipFromLog(sim.getStore(lateId).getCommittedLogEntries()),
    );
    expect(membership[PEER.authority]).toBe(3);
    expect(ticTacToeBoardCell(sim.getCommittedState(lateId), 4)).toBe('X');

    sim.destroy();
  });
});
