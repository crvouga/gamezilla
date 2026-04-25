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
import { membershipToRecord, rebuildMembershipFromLog } from './membership';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const BASE = { 'player-x': 1, 'player-o': 1, authority: 3 } as const;

function createSim() {
  const sim = new DeterministicSimulator(TicTacToeModule, {
    topic: 'membership-test',
    initialMembership: { ...BASE },
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  });

  return sim;
}

function readMembership(sim: DeterministicSimulator, peerId: string): Record<string, number> {
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
    for (const id of [...Object.keys(BASE), 'newbie']) {
      expect(readMembership(sim, id)).toEqual({
        ...BASE,
        newbie: 2,
      });
    }
    sim.destroy();
  });

  it('authority can trust_update', () => {
    const sim = createSim();
    sim.dispatch(
      'authority',
      PeerTrustUpdate({ peerId: 'player-x', trust: 99 })
    );
    sim.deliverPending();
    expect(readMembership(sim, 'authority')['player-x']).toBe(99);
    sim.destroy();
  });

  it('non-authority trust_update is rejected', () => {
    const sim = createSim();
    const before = readMembership(sim, 'authority')['player-o'];
    sim.dispatch(
      'player-x',
      PeerTrustUpdate({ peerId: 'player-o', trust: 99 })
    );
    sim.deliverPending();
    expect(readMembership(sim, 'authority')['player-o']).toBe(before);
    sim.destroy();
  });

  it('self leave removes peer', () => {
    const sim = createSim();
    sim.dispatch('player-x', PeerLeave({ peerId: 'player-x' }));
    sim.deliverPending();
    expect(readMembership(sim, 'authority')['player-x']).toBeUndefined();
    sim.destroy();
  });
});
