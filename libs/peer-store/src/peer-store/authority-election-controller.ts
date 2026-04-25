import type { PeerStore } from './peer-store';
import type {
  PeerStoreAuthorityElectionContext,
  PeerStoreAuthorityStrategy,
} from './peer-store-types';
import { PeerStoreTrustElectionFailed } from '../protocol/store-errors';
import { TrustElection } from '../trust-election/trust-election';

export class AuthorityElectionController {
  private readonly store: PeerStore;
  private readonly trustElectionTimeoutMs: number;
  private readonly strategy: PeerStoreAuthorityStrategy | undefined;
  private active: TrustElection | null = null;
  /** Suppress reacting to liveness authority noise while applying trust commits. */
  private suppressNotify = false;
  private destroyed = false;
  private lastCompletedElectionKey: string | null = null;

  constructor(
    store: PeerStore,
    opts: { trustElectionTimeoutMs: number; strategy?: PeerStoreAuthorityStrategy },
  ) {
    this.store = store;
    this.trustElectionTimeoutMs = opts.trustElectionTimeoutMs;
    this.strategy = opts.strategy;
  }

  notifySynced(): void {
    if (this.destroyed) return;
    const id = `${this.store.topic}:sync:${this.store.last_committed_log_seq}`;
    void this.runElectionRound(id);
  }

  notifyAuthorityChange(prev: string, next: string): void {
    if (this.destroyed || this.suppressNotify) return;
    if (prev === next) return;
    const id = `${this.store.topic}:liveness:${prev}>${next}`;
    void this.runElectionRound(id);
  }

  private buildContext(): PeerStoreAuthorityElectionContext {
    return {
      peerId: this.store.peerId,
      topic: this.store.topic,
      currentAuthority: this.store.current_authority,
      authorityOrder: this.store.authority_order,
      membershipPeerIds: [...this.store.membership.keys()].sort((a, b) =>
        a.localeCompare(b),
      ),
      lastCommittedLogSeq: this.store.last_committed_log_seq,
    };
  }

  private electionShouldRun(electionId: string): boolean {
    if (this.destroyed) return false;
    if (!this.store.isSynced()) return false;
    if (this.store.membership.size < 2) return false;
    if (this.lastCompletedElectionKey === electionId) return false;
    if (this.active !== null) return false;
    const expectedPeers = [...this.store.membership.keys()].sort((a, b) =>
      a.localeCompare(b),
    );
    return expectedPeers.includes(this.store.peerId);
  }

  private async runElectionRound(electionId: string): Promise<void> {
    if (!this.electionShouldRun(electionId)) return;

    const expectedPeers = [...this.store.membership.keys()].sort((a, b) =>
      a.localeCompare(b),
    );
    const ctx = this.buildContext();
    const defaultVote = this.store.current_authority;
    const myVote = this.strategy?.myVote?.(ctx) ?? defaultVote;

    const fp =
      this.store.security.peerFingerprints !== undefined
        ? { peerFingerprints: this.store.security.peerFingerprints }
        : {};

    const election = new TrustElection({
      electionId,
      peerId: this.store.peerId,
      expectedPeers,
      transport: this.store.transport,
      myVote,
      roomSecret: this.store.security.roomSecret,
      secretSeed: this.store.security.secretSeed,
      timeoutMs: this.trustElectionTimeoutMs,
      ...fp,
    });
    this.active = election;

    try {
      const map = await election.resolve();
      this.afterElectionResolved(electionId, map);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      this.store.callbacks.onError?.(PeerStoreTrustElectionFailed({ detail }));
    } finally {
      election.destroy();
      if (this.active === election) {
        this.active = null;
      }
    }
  }

  private afterElectionResolved(electionId: string, map: Record<string, number>): void {
    if (this.destroyed) return;
    if (this.store.isAuthority()) {
      this.suppressNotify = true;
      try {
        this.store.applyAuthorityTrustMap(map);
      } finally {
        this.suppressNotify = false;
      }
    }
    this.lastCompletedElectionKey = electionId;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active?.destroy();
    this.active = null;
  }
}
