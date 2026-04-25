import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { TrustElection, computeTrustMap, type TrustVote } from './trust-election';
import { InMemoryBus, InMemoryTransport } from '../transport';
import { TestCrashHandler } from '../testing/test-crash-handler';
import { testPeerForLabel } from '../testing/tictactoe-peers';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

const ROOM = 'trust-election-test-room';

function peer(label: string) {
  return testPeerForLabel(`trust-election:${label}`);
}

describe('computeTrustMap', () => {
  it('all peers vote for same peer → that peer has highest trust', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'server' },
      { from: 'bob', trustedPeer: 'server' },
      { from: 'server', trustedPeer: 'server' },
    ];
    const map = computeTrustMap(votes, ['alice', 'bob', 'server']);
    expect(map['server']).toBe(4);
    expect(map['alice']).toBe(1);
    expect(map['bob']).toBe(1);
  });

  it('duplicate voter rows → first vote wins', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'server' },
      { from: 'alice', trustedPeer: 'bob' },
      { from: 'bob', trustedPeer: 'server' },
    ];
    const map = computeTrustMap(votes, ['alice', 'bob', 'server']);
    expect(map['server']).toBe(3);
    expect(map['bob']).toBe(1);
  });

  it('each peer votes for themselves → all equal', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'alice' },
      { from: 'bob', trustedPeer: 'bob' },
      { from: 'charlie', trustedPeer: 'charlie' },
    ];
    const map = computeTrustMap(votes, ['alice', 'bob', 'charlie']);
    expect(map['alice']).toBe(2);
    expect(map['bob']).toBe(2);
    expect(map['charlie']).toBe(2);
  });

  it('majority votes for referee → referee has highest trust', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'referee' },
      { from: 'bob', trustedPeer: 'referee' },
      { from: 'referee', trustedPeer: 'referee' },
    ];
    const map = computeTrustMap(votes, ['alice', 'bob', 'referee']);
    expect(map['referee']).toBe(4);
  });

  it('no votes → all peers at base weight', () => {
    const map = computeTrustMap([], ['a', 'b', 'c']);
    expect(map['a']).toBe(1);
    expect(map['b']).toBe(1);
    expect(map['c']).toBe(1);
  });

  it('split vote → voters each get +1', () => {
    const votes: TrustVote[] = [
      { from: 'a', trustedPeer: 'b' },
      { from: 'b', trustedPeer: 'a' },
    ];
    const map = computeTrustMap(votes, ['a', 'b']);
    expect(map['a']).toBe(2);
    expect(map['b']).toBe(2);
  });

  it('crash on <2 peers', () => {
    expect(() => computeTrustMap([], ['only'])).toThrow();
  });

  it('crash on empty peer id', () => {
    expect(() => computeTrustMap([], ['a', ''])).toThrow();
  });

  it('crash on vote for unknown peer', () => {
    expect(() =>
      computeTrustMap([{ from: 'a', trustedPeer: 'unknown' }], ['a', 'b']),
    ).toThrow();
  });
});

describe('TrustElection', () => {
  it('unanimous vote resolves with correct trust map', async () => {
    const bus = new InMemoryBus();
    const labels = ['alice', 'bob', 'server'];
    const ids = labels.map((l) => peer(l).peerId);
    const transports = ids.map((id) => new InMemoryTransport(bus, id));
    const serverId = peer('server').peerId;
    const elections = ids.map(
      (peerId, i) =>
        new TrustElection({
          electionId: 'el-unanimous',
          peerId,
          expectedPeers: ids,
          transport: transports[i]!,
          myVote: serverId,
          roomSecret: ROOM,
          secretSeed: peer(labels[i]!).secretSeed,
          timeoutMs: 5000,
        }),
    );

    const results = await Promise.all(elections.map((e) => e.resolve()));

    for (const result of results) {
      expect(result[serverId]).toBe(4);
    }

    for (const e of elections) e.destroy();
    for (const t of transports) t.destroy();
    bus.destroy();
  });

  it('split vote resolves with all equal', async () => {
    const bus = new InMemoryBus();
    const a = peer('split-a');
    const b = peer('split-b');
    const ids = [a.peerId, b.peerId];

    const t_a = new InMemoryTransport(bus, a.peerId);
    const t_b = new InMemoryTransport(bus, b.peerId);

    const e_a = new TrustElection({
      electionId: 'el-split',
      peerId: a.peerId,
      expectedPeers: ids,
      transport: t_a,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: a.secretSeed,
    });
    const e_b = new TrustElection({
      electionId: 'el-split',
      peerId: b.peerId,
      expectedPeers: ids,
      transport: t_b,
      myVote: b.peerId,
      roomSecret: ROOM,
      secretSeed: b.secretSeed,
    });

    const [map_a, map_b] = await Promise.all([e_a.resolve(), e_b.resolve()]);

    expect(map_a[a.peerId]).toBe(2);
    expect(map_a[b.peerId]).toBe(2);
    expect(JSON.stringify(map_a)).toBe(JSON.stringify(map_b));

    e_a.destroy();
    e_b.destroy();
    t_a.destroy();
    t_b.destroy();
    bus.destroy();
  });

  it('timeout rejects when not all votes received', async () => {
    const bus = new InMemoryBus();
    const a = peer('to-a');
    const b = peer('to-b');
    const t_a = new InMemoryTransport(bus, a.peerId);

    const e = new TrustElection({
      electionId: 'el-timeout',
      peerId: a.peerId,
      expectedPeers: [a.peerId, b.peerId],
      transport: t_a,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: a.secretSeed,
      timeoutMs: 50,
    });

    await expect(e.resolve()).rejects.toThrow('timed out');

    e.destroy();
    t_a.destroy();
    bus.destroy();
  });

  it('late joiner receives vote via onConnect re-broadcast', async () => {
    const bus = new InMemoryBus();
    const a = peer('late-a');
    const b = peer('late-b');
    const ids = [a.peerId, b.peerId];

    const t_a = new InMemoryTransport(bus, a.peerId);
    const t_b = new InMemoryTransport(bus, b.peerId);

    t_b.disconnect();

    const e_a = new TrustElection({
      electionId: 'el-late',
      peerId: a.peerId,
      expectedPeers: ids,
      transport: t_a,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: a.secretSeed,
    });

    const e_b = new TrustElection({
      electionId: 'el-late',
      peerId: b.peerId,
      expectedPeers: ids,
      transport: t_b,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: b.secretSeed,
      timeoutMs: 5000,
    });

    t_b.reconnect();

    const [map_a, map_b] = await Promise.all([e_a.resolve(), e_b.resolve()]);

    expect(map_a[a.peerId]).toBe(3);
    expect(JSON.stringify(map_a)).toBe(JSON.stringify(map_b));

    e_a.destroy();
    e_b.destroy();
    t_a.destroy();
    t_b.destroy();
    bus.destroy();
  });

  it('destroy prevents further resolution', () => {
    const bus = new InMemoryBus();
    const a = peer('d-a');
    const b = peer('d-b');
    const t = new InMemoryTransport(bus, a.peerId);

    const e = new TrustElection({
      electionId: 'el-destroy',
      peerId: a.peerId,
      expectedPeers: [a.peerId, b.peerId],
      transport: t,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: a.secretSeed,
    });

    e.destroy();
    expect(() => e.resolve()).toThrow('destroyed');

    t.destroy();
    bus.destroy();
  });

  it('double resolve → crash', async () => {
    const bus = new InMemoryBus();
    const a = peer('dr-a');
    const b = peer('dr-b');
    const ids = [a.peerId, b.peerId];
    const t_a = new InMemoryTransport(bus, a.peerId);
    const t_b = new InMemoryTransport(bus, b.peerId);

    const e_a = new TrustElection({
      electionId: 'el-double',
      peerId: a.peerId,
      expectedPeers: ids,
      transport: t_a,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: a.secretSeed,
    });
    const _e_b = new TrustElection({
      electionId: 'el-double',
      peerId: b.peerId,
      expectedPeers: ids,
      transport: t_b,
      myVote: a.peerId,
      roomSecret: ROOM,
      secretSeed: b.secretSeed,
    });

    await e_a.resolve();
    expect(() => e_a.resolve()).toThrow('already resolved');

    e_a.destroy();
    _e_b.destroy();
    t_a.destroy();
    t_b.destroy();
    bus.destroy();
  });
});
