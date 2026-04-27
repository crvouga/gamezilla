import { Assert } from '@gamezilla/lib/assert';
import type { Transport } from '../transport/transport-types';
import { fingerprintFromPublicKey } from '../room/security/peer-crypto';
import {
  signTrustBallotEnvelope,
  trustElectionTransportTopic,
  verifyTrustBallotEnvelope,
  type TrustBallotBody,
  type VerifiedTrustBallot,
} from './ballot-envelope';

const crash: Assert = Assert.crash();

export type TrustVote = {
  from: string;
  trustedPeer: string;
};

/**
 * Computes a deterministic trust map from a set of votes.
 *
 * Every peer in `allPeers` receives a base weight of 1. Each vote for a peer
 * adds 1 to that peer's weight. The resulting map can be passed directly to
 * `Room` — the peer with the highest weight becomes the authority.
 *
 * If `votes` contains multiple rows for the same `from`, **first** wins.
 */
export function computeTrustMap(
  votes: TrustVote[],
  allPeers: string[],
): Record<string, number> {
  crash.ok(allPeers.length >= 2, 'computeTrustMap requires at least 2 peers');

  const trust: Record<string, number> = {};
  for (const peer of allPeers) {
    crash.nonEmptyString(peer, 'peer id must be non-empty');
    trust[peer] = 1;
  }
  const seenVoter = new Set<string>();
  for (const vote of votes) {
    crash.nonEmptyString(vote.from, 'vote.from must be non-empty');
    crash.nonEmptyString(
      vote.trustedPeer,
      'vote.trustedPeer must be non-empty',
    );
    if (seenVoter.has(vote.from)) continue;
    seenVoter.add(vote.from);
    crash.ok(
      vote.trustedPeer in trust,
      `vote.trustedPeer "${vote.trustedPeer}" is not in allPeers`,
    );
    trust[vote.trustedPeer]! += 1;
  }
  return trust;
}

/**
 * Signed trust election over `Transport` on topic `trust-election:<electionId>`.
 */
export class TrustElection {
  private readonly peerId: string;
  private readonly electionId: string;
  private readonly topic: string;
  private readonly roomSecret: string;
  private readonly secretSeed: Uint8Array;
  private readonly expectedPeers: Set<string>;
  private readonly peerFingerprints: Record<string, string> | undefined;
  private readonly transport: Transport;
  private readonly myVote: string;
  private readonly timeoutMs: number;

  private readonly received_votes = new Map<string, TrustVote>();
  private readonly inboundCounters = new Map<string, number>();
  private outboundCounter = 0;
  private resolved = false;
  private is_destroyed = false;
  private transport_unsubscribe: (() => void) | null = null;
  private connect_unsubscribe: (() => void) | null = null;
  private timeout_handle: ReturnType<typeof setTimeout> | null = null;
  private resolve_fn: ((map: Record<string, number>) => void) | null = null;

  constructor(config: {
    electionId: string;
    peerId: string;
    expectedPeers: string[];
    transport: Transport;
    myVote: string;
    roomSecret: string;
    secretSeed: Uint8Array;
    peerFingerprints?: Record<string, string>;
    timeoutMs?: number;
  }) {
    crash.nonEmptyString(config.electionId, 'electionId must be non-empty');
    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty');
    crash.ok(
      config.expectedPeers.length >= 2,
      'expectedPeers must have at least 2 members',
    );
    crash.ok(
      config.expectedPeers.includes(config.peerId),
      'expectedPeers must include peerId',
    );
    crash.ok(
      config.expectedPeers.includes(config.myVote),
      'myVote must be one of expectedPeers',
    );
    crash.nonEmptyString(config.roomSecret, 'roomSecret must be non-empty');
    crash.ok(
      config.secretSeed instanceof Uint8Array &&
        config.secretSeed.length === 32,
      'secretSeed must be Uint8Array length 32',
    );

    this.electionId = config.electionId;
    this.topic = trustElectionTransportTopic(config.electionId);
    this.peerId = config.peerId;
    this.expectedPeers = new Set(config.expectedPeers);
    this.transport = config.transport;
    this.myVote = config.myVote;
    this.roomSecret = config.roomSecret;
    this.secretSeed = config.secretSeed;
    this.peerFingerprints = config.peerFingerprints;
    this.timeoutMs = config.timeoutMs ?? 10_000;

    this.received_votes.set(this.peerId, {
      from: this.peerId,
      trustedPeer: this.myVote,
    });

    this.transport_unsubscribe = this.transport.subscribe(this.topic, (payload: unknown) =>
      this.handleMessage(payload),
    );

    this.connect_unsubscribe = this.transport.onConnect(() => {
      this.broadcastVote();
    });

    this.broadcastVote();
  }

  resolve(): Promise<Record<string, number>> {
    crash.ok(!this.is_destroyed, 'cannot resolve destroyed election');
    crash.ok(!this.resolved, 'election already resolved');

    return new Promise<Record<string, number>>((resolve, reject) => {
      this.resolve_fn = resolve;
      if (this.hasAllVotes()) {
        this.finalize();
        return;
      }

      this.timeout_handle = setTimeout(() => {
        if (this.resolved || this.is_destroyed) return;
        this.resolved = true;
        reject(new Error('trust election timed out'));
      }, this.timeoutMs);
    });
  }

  destroy(): void {
    if (this.is_destroyed) return;
    this.is_destroyed = true;

    if (this.timeout_handle !== null) {
      clearTimeout(this.timeout_handle);
      this.timeout_handle = null;
    }
    if (this.transport_unsubscribe) {
      this.transport_unsubscribe();
      this.transport_unsubscribe = null;
    }
    if (this.connect_unsubscribe) {
      this.connect_unsubscribe();
      this.connect_unsubscribe = null;
    }
    this.resolve_fn = null;
  }

  private broadcastVote(): void {
    if (this.is_destroyed || this.resolved) return;
    this.outboundCounter += 1;
    const body: TrustBallotBody = {
      kind: 'trust-vote-v2',
      electionId: this.electionId,
      voterPeerId: this.peerId,
      trustedPeer: this.myVote,
    };
    const env = signTrustBallotEnvelope({
      electionId: this.electionId,
      topic: this.topic,
      roomSecret: this.roomSecret,
      body,
      signerPeerId: this.peerId,
      secretSeed: this.secretSeed,
      counter: this.outboundCounter,
    });
    this.transport.publish(this.topic, env);
  }

  private handleMessage(payload: unknown): void {
    if (this.is_destroyed || this.resolved) return;
    const vr = verifyTrustBallotEnvelope({
      topic: this.topic,
      roomSecret: this.roomSecret,
      raw: payload,
      lastCounters: this.inboundCounters,
    });
    if (!('signerPublicKey' in vr)) return;
    this.applyVerifiedBallot(vr);
  }

  private trustBallotFingerprintOk(
    signerPeerId: string,
    signerPublicKey: Uint8Array,
  ): boolean {
    const expectedFp = this.peerFingerprints?.[signerPeerId];
    if (expectedFp === undefined) return true;
    return fingerprintFromPublicKey(signerPublicKey) === expectedFp;
  }

  private trustBallotContextOk(
    signerPeerId: string,
    body: TrustBallotBody,
  ): boolean {
    return (
      body.electionId === this.electionId &&
      this.expectedPeers.has(signerPeerId) &&
      this.expectedPeers.has(body.trustedPeer) &&
      signerPeerId !== this.peerId
    );
  }

  private applyVerifiedBallot(vr: VerifiedTrustBallot): void {
    const { signerPeerId, signerPublicKey, counter, body } = vr;

    if (!this.trustBallotFingerprintOk(signerPeerId, signerPublicKey)) return;
    if (!this.trustBallotContextOk(signerPeerId, body)) return;

    this.inboundCounters.set(signerPeerId, counter);

    const isNew = !this.received_votes.has(signerPeerId);
    this.received_votes.set(signerPeerId, {
      from: signerPeerId,
      trustedPeer: body.trustedPeer,
    });

    if (isNew) {
      this.broadcastVote();
    }

    if (this.hasAllVotes() && this.resolve_fn) {
      this.finalize();
    }
  }

  private hasAllVotes(): boolean {
    for (const peer of this.expectedPeers) {
      if (!this.received_votes.has(peer)) return false;
    }
    return true;
  }

  private finalize(): void {
    if (this.resolved) return;
    this.resolved = true;

    if (this.timeout_handle !== null) {
      clearTimeout(this.timeout_handle);
      this.timeout_handle = null;
    }

    const votes = [...this.received_votes.values()];
    const allPeers = [...this.expectedPeers];
    const trustMap = computeTrustMap(votes, allPeers);

    this.resolve_fn?.(trustMap);
  }
}
