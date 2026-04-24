import { Assert } from '@gamezilla/lib/assert'
import type { Transport } from './types'

const crash: Assert = Assert.crash()

const TOPIC = 'trust-election'

export type TrustVote = {
  from: string
  trustedPeer: string
}

type VoteWireMessage = {
  kind: 'trust-vote'
  from: string
  trustedPeer: string
}

/**
 * Computes a deterministic trust map from a set of votes.
 *
 * Every peer in `allPeers` receives a base weight of 1. Each vote for a peer
 * adds 1 to that peer's weight. The resulting map can be passed directly to
 * `PeerStore` — the peer with the highest weight becomes the authority.
 */
export function computeTrustMap(
  votes: TrustVote[],
  allPeers: string[],
): Record<string, number> {
  crash.ok(allPeers.length >= 2, 'computeTrustMap requires at least 2 peers')

  const trust: Record<string, number> = {}
  for (const peer of allPeers) {
    crash.nonEmptyString(peer, 'peer id must be non-empty')
    trust[peer] = 1
  }
  for (const vote of votes) {
    crash.nonEmptyString(vote.from, 'vote.from must be non-empty')
    crash.nonEmptyString(vote.trustedPeer, 'vote.trustedPeer must be non-empty')
    crash.ok(
      vote.trustedPeer in trust,
      `vote.trustedPeer "${vote.trustedPeer}" is not in allPeers`,
    )
    trust[vote.trustedPeer]! += 1
  }
  return trust
}

/**
 * Lightweight trust election protocol.
 *
 * Each peer votes for who they trust as authority. When all expected peers
 * have voted, the election resolves with a deterministic trust map computed
 * by `computeTrustMap`.
 *
 * The election runs over the same `Transport` used by `PeerStore`, on a
 * separate topic (`trust-election`).
 */
export class TrustElection {
  private readonly peerId: string
  private readonly expectedPeers: Set<string>
  private readonly transport: Transport
  private readonly myVote: string
  private readonly timeoutMs: number

  private readonly received_votes = new Map<string, TrustVote>()
  private resolved = false
  private is_destroyed = false
  private transport_unsubscribe: (() => void) | null = null
  private connect_unsubscribe: (() => void) | null = null
  private timeout_handle: ReturnType<typeof setTimeout> | null = null
  private resolve_fn: ((map: Record<string, number>) => void) | null = null

  constructor(config: {
    peerId: string
    expectedPeers: string[]
    transport: Transport
    myVote: string
    timeoutMs?: number
  }) {
    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty')
    crash.ok(
      config.expectedPeers.length >= 2,
      'expectedPeers must have at least 2 members',
    )
    crash.ok(
      config.expectedPeers.includes(config.peerId),
      'expectedPeers must include peerId',
    )
    crash.ok(
      config.expectedPeers.includes(config.myVote),
      'myVote must be one of expectedPeers',
    )

    this.peerId = config.peerId
    this.expectedPeers = new Set(config.expectedPeers)
    this.transport = config.transport
    this.myVote = config.myVote
    this.timeoutMs = config.timeoutMs ?? 10_000

    this.received_votes.set(this.peerId, {
      from: this.peerId,
      trustedPeer: this.myVote,
    })

    this.transport_unsubscribe = this.transport.subscribe(
      TOPIC,
      (payload: unknown) => this.handleMessage(payload),
    )

    this.connect_unsubscribe = this.transport.onConnect(() => {
      this.broadcastVote()
    })

    this.broadcastVote()
  }

  resolve(): Promise<Record<string, number>> {
    crash.ok(!this.is_destroyed, 'cannot resolve destroyed election')
    crash.ok(!this.resolved, 'election already resolved')

    return new Promise<Record<string, number>>((resolve, reject) => {
      this.resolve_fn = resolve
      if (this.hasAllVotes()) {
        this.finalize()
        return
      }

      this.timeout_handle = setTimeout(() => {
        if (this.resolved || this.is_destroyed) return
        this.resolved = true
        reject(new Error('trust election timed out'))
      }, this.timeoutMs)
    })
  }

  destroy(): void {
    if (this.is_destroyed) return
    this.is_destroyed = true

    if (this.timeout_handle !== null) {
      clearTimeout(this.timeout_handle)
      this.timeout_handle = null
    }
    if (this.transport_unsubscribe) {
      this.transport_unsubscribe()
      this.transport_unsubscribe = null
    }
    if (this.connect_unsubscribe) {
      this.connect_unsubscribe()
      this.connect_unsubscribe = null
    }
    this.resolve_fn = null
  }

  private broadcastVote(): void {
    if (this.is_destroyed || this.resolved) return
    const wire: VoteWireMessage = {
      kind: 'trust-vote',
      from: this.peerId,
      trustedPeer: this.myVote,
    }
    this.transport.publish(TOPIC, wire)
  }

  private handleMessage(payload: unknown): void {
    if (this.is_destroyed || this.resolved) return
    if (typeof payload !== 'object' || payload === null) return

    const msg = payload as Record<string, unknown>
    if (msg['kind'] !== 'trust-vote') return

    const from = msg['from'] as string
    const trustedPeer = msg['trustedPeer'] as string
    if (!from || !trustedPeer) return
    if (!this.expectedPeers.has(from)) return
    if (from === this.peerId) return

    const isNew = !this.received_votes.has(from)
    this.received_votes.set(from, { from, trustedPeer })

    if (isNew) {
      this.broadcastVote()
    }

    if (this.hasAllVotes() && this.resolve_fn) {
      this.finalize()
    }
  }

  private hasAllVotes(): boolean {
    for (const peer of this.expectedPeers) {
      if (!this.received_votes.has(peer)) return false
    }
    return true
  }

  private finalize(): void {
    if (this.resolved) return
    this.resolved = true

    if (this.timeout_handle !== null) {
      clearTimeout(this.timeout_handle)
      this.timeout_handle = null
    }

    const votes = [...this.received_votes.values()]
    const allPeers = [...this.expectedPeers]
    const trustMap = computeTrustMap(votes, allPeers)

    this.resolve_fn?.(trustMap)
  }
}
