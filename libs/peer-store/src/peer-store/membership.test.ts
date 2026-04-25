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
import { TicTacToeModule } from '../testing/fixtures/tic-tac-toe.module';
import { DeterministicSimulator } from '../simulator';
import { PeerLeave, PeerTrustUpdate } from '../protocol/system-messages';
import { TestCrashHandler } from '../testing/test-crash-handler';
import {
  testPeerForLabel,
  ticTacToeThreePeers,
} from '../testing/tictactoe-peers';
import { membershipToRecord, rebuildMembershipFromLog } from './membership';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const FIX = ticTacToeThreePeers();
const BASE = FIX.initialMembership;
const PEER = {
  authority: FIX.peers.authority.peerId,
  playerX: FIX.peers.playerX.peerId,
  playerO: FIX.peers.playerO.peerId,
} as const;

function createSim() {
  return new DeterministicSimulator(TicTacToeModule, {
    topic: 'membership-test',
    initialMembership: { ...BASE },
    initialMemberPublicKeys: FIX.initialMemberPublicKeys,
    roomSecret: FIX.roomSecret,
    peerSecretSeeds: FIX.peerSecretSeeds,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  });
}

function readMembership(
  sim: DeterministicSimulator,
  peerId: string,
): Record<string, number> {
  const entries = sim.getStore(peerId).getCommittedLogEntries();
  return membershipToRecord(rebuildMembershipFromLog(entries));
}

describe('Dynamic membership', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('genesis seeds membership for all peers', () => {
    const sim = createSim();
    for (const id of Object.keys(BASE)) {
      expect(readMembership(sim, id)).toEqual(BASE);
    }
    sim.destroy();
  });

  it('joinPeer adds member after sync and propose', () => {
    const sim = createSim();
    sim.joinPeer('newbie', 2);
    sim.deliverPending();
    const newbieId = testPeerForLabel('newbie').peerId;
    for (const id of [...Object.keys(BASE), newbieId]) {
      expect(readMembership(sim, id)).toEqual({
        ...BASE,
        [newbieId]: 2,
      });
    }
    sim.destroy();
  });

  it('authority can trust_update', () => {
    const sim = createSim();
    sim.dispatch(
      PEER.authority,
      PeerTrustUpdate({ peerId: PEER.playerX, trust: 99 }),
    );
    sim.deliverPending();
    expect(readMembership(sim, PEER.authority)[PEER.playerX]).toBe(99);
    sim.destroy();
  });

  it('non-authority trust_update is rejected', () => {
    const sim = createSim();
    const before = readMembership(sim, PEER.authority)[PEER.playerO];
    sim.dispatch(
      PEER.playerX,
      PeerTrustUpdate({ peerId: PEER.playerO, trust: 99 }),
    );
    sim.deliverPending();
    expect(readMembership(sim, PEER.authority)[PEER.playerO]).toBe(before);
    sim.destroy();
  });

  it('self leave removes peer', () => {
    const sim = createSim();
    sim.dispatch(PEER.playerX, PeerLeave({ peerId: PEER.playerX }));
    sim.deliverPending();
    expect(readMembership(sim, PEER.authority)[PEER.playerX]).toBeUndefined();
    sim.destroy();
  });
});
