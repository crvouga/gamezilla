import { Assert } from '@gamezilla/shared/assert'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { TrustElection, computeTrustMap, type TrustVote } from '../trust-election'
import { InMemoryBus, InMemoryTransport } from '../transport'
import { TestCrashHandler } from './test-crash-handler'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

describe('computeTrustMap', () => {
  it('all peers vote for same peer → that peer has highest trust', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'server' },
      { from: 'bob', trustedPeer: 'server' },
      { from: 'server', trustedPeer: 'server' },
    ]
    const map = computeTrustMap(votes, ['alice', 'bob', 'server'])
    expect(map['server']).toBe(4)
    expect(map['alice']).toBe(1)
    expect(map['bob']).toBe(1)
  })

  it('each peer votes for themselves → all equal', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'alice' },
      { from: 'bob', trustedPeer: 'bob' },
      { from: 'charlie', trustedPeer: 'charlie' },
    ]
    const map = computeTrustMap(votes, ['alice', 'bob', 'charlie'])
    expect(map['alice']).toBe(2)
    expect(map['bob']).toBe(2)
    expect(map['charlie']).toBe(2)
  })

  it('majority votes for referee → referee has highest trust', () => {
    const votes: TrustVote[] = [
      { from: 'alice', trustedPeer: 'referee' },
      { from: 'bob', trustedPeer: 'referee' },
      { from: 'referee', trustedPeer: 'referee' },
    ]
    const map = computeTrustMap(votes, ['alice', 'bob', 'referee'])
    expect(map['referee']).toBe(4)
  })

  it('no votes → all peers at base weight', () => {
    const map = computeTrustMap([], ['a', 'b', 'c'])
    expect(map['a']).toBe(1)
    expect(map['b']).toBe(1)
    expect(map['c']).toBe(1)
  })

  it('split vote → voters each get +1', () => {
    const votes: TrustVote[] = [
      { from: 'a', trustedPeer: 'b' },
      { from: 'b', trustedPeer: 'a' },
    ]
    const map = computeTrustMap(votes, ['a', 'b'])
    expect(map['a']).toBe(2)
    expect(map['b']).toBe(2)
  })

  it('crash on <2 peers', () => {
    expect(() => computeTrustMap([], ['only'])).toThrow()
  })

  it('crash on empty peer id', () => {
    expect(() => computeTrustMap([], ['a', ''])).toThrow()
  })

  it('crash on vote for unknown peer', () => {
    expect(() =>
      computeTrustMap(
        [{ from: 'a', trustedPeer: 'unknown' }],
        ['a', 'b'],
      ),
    ).toThrow()
  })
})

describe('TrustElection', () => {
  it('unanimous vote resolves with correct trust map', async () => {
    const bus = new InMemoryBus()
    const peers = ['alice', 'bob', 'server']

    const transports = peers.map((p) => new InMemoryTransport(bus, p))
    const elections = peers.map(
      (peerId, i) =>
        new TrustElection({
          peerId,
          expectedPeers: peers,
          transport: transports[i]!,
          myVote: 'server',
          timeoutMs: 5000,
        }),
    )

    const results = await Promise.all(elections.map((e) => e.resolve()))

    for (const result of results) {
      expect(result['server']).toBe(4)
      expect(result['alice']).toBe(1)
      expect(result['bob']).toBe(1)
    }

    for (const e of elections) e.destroy()
    for (const t of transports) t.destroy()
    bus.destroy()
  })

  it('split vote resolves with all equal', async () => {
    const bus = new InMemoryBus()
    const peers = ['alice', 'bob']

    const t_a = new InMemoryTransport(bus, 'alice')
    const t_b = new InMemoryTransport(bus, 'bob')

    const e_a = new TrustElection({
      peerId: 'alice',
      expectedPeers: peers,
      transport: t_a,
      myVote: 'alice',
    })
    const e_b = new TrustElection({
      peerId: 'bob',
      expectedPeers: peers,
      transport: t_b,
      myVote: 'bob',
    })

    const [map_a, map_b] = await Promise.all([e_a.resolve(), e_b.resolve()])

    expect(map_a['alice']).toBe(2)
    expect(map_a['bob']).toBe(2)
    expect(JSON.stringify(map_a)).toBe(JSON.stringify(map_b))

    e_a.destroy()
    e_b.destroy()
    t_a.destroy()
    t_b.destroy()
    bus.destroy()
  })

  it('timeout rejects when not all votes received', async () => {
    const bus = new InMemoryBus()
    const t_a = new InMemoryTransport(bus, 'alice')

    const e = new TrustElection({
      peerId: 'alice',
      expectedPeers: ['alice', 'bob'],
      transport: t_a,
      myVote: 'alice',
      timeoutMs: 50,
    })

    await expect(e.resolve()).rejects.toThrow('timed out')

    e.destroy()
    t_a.destroy()
    bus.destroy()
  })

  it('late joiner receives vote via onConnect re-broadcast', async () => {
    const bus = new InMemoryBus()
    const peers = ['alice', 'bob']

    const t_a = new InMemoryTransport(bus, 'alice')
    const t_b = new InMemoryTransport(bus, 'bob')

    t_b.disconnect()

    const e_a = new TrustElection({
      peerId: 'alice',
      expectedPeers: peers,
      transport: t_a,
      myVote: 'alice',
    })

    const e_b = new TrustElection({
      peerId: 'bob',
      expectedPeers: peers,
      transport: t_b,
      myVote: 'alice',
      timeoutMs: 5000,
    })

    t_b.reconnect()

    const [map_a, map_b] = await Promise.all([e_a.resolve(), e_b.resolve()])

    expect(map_a['alice']).toBe(3)
    expect(JSON.stringify(map_a)).toBe(JSON.stringify(map_b))

    e_a.destroy()
    e_b.destroy()
    t_a.destroy()
    t_b.destroy()
    bus.destroy()
  })

  it('destroy prevents further resolution', () => {
    const bus = new InMemoryBus()
    const t = new InMemoryTransport(bus, 'a')

    const e = new TrustElection({
      peerId: 'a',
      expectedPeers: ['a', 'b'],
      transport: t,
      myVote: 'a',
    })

    e.destroy()
    expect(() => e.resolve()).toThrow('destroyed')

    t.destroy()
    bus.destroy()
  })

  it('double resolve → crash', async () => {
    const bus = new InMemoryBus()
    const peers = ['a', 'b']
    const t_a = new InMemoryTransport(bus, 'a')
    const t_b = new InMemoryTransport(bus, 'b')

    const e_a = new TrustElection({
      peerId: 'a',
      expectedPeers: peers,
      transport: t_a,
      myVote: 'a',
    })
    const _e_b = new TrustElection({
      peerId: 'b',
      expectedPeers: peers,
      transport: t_b,
      myVote: 'a',
    })

    await e_a.resolve()
    expect(() => e_a.resolve()).toThrow('already resolved')

    e_a.destroy()
    _e_b.destroy()
    t_a.destroy()
    t_b.destroy()
    bus.destroy()
  })
})
