import { assert } from '@gamezilla/lib/assert';
import { PeerTrustUpdate } from '@gamezilla/room/system-messages';
import { DeterministicSimulator } from '@gamezilla/room/simulator';
import {
  TickClock,
  TicTacToeModule,
} from '@gamezilla/room/testkit/tic-tac-toe';
import {
  testPeerForLabel,
  type TicTacToeTestPeer,
} from '@gamezilla/room/testkit/tic-tac-toe-peers';
import { computeTrustMap, type TrustVote } from '@gamezilla/room/trust';
import type { Event, Message, State } from '@gamezilla/room/types';
import { formatLogForClipboard } from './playground-format';
import {
  PEERS,
  TRUST_MAP,
  type LogEntry,
  type PeerId,
} from './playground-types';
import {
  createCheatController,
  type CheatController,
} from './playground-cheats';

export {
  PEERS,
  TRUST_MAP,
  type CheatLogEntry,
  type LogEntry,
  type MessageLogEntry,
  type PeerId
} from './playground-types';

export type PeerCryptoSummary = {
  label: PeerId;
  peerId: string;
  publicKeyB64: string;
};

export type SimClockSnapshot = {
  clockStatus: 'idle' | 'running' | 'finished';
  remainingMsX: number;
  remainingMsO: number;
  clockActivePlayer: 'X' | 'O' | null;
};

export type ElectionRanking = Record<PeerId, PeerId[]>;

assert.notThrows(
  () => testPeerForLabel('room-playground:import-smoke'),
  'room playground must derive test peers (node:crypto + ed25519)'
);

function playgroundPeer(id: PeerId): TicTacToeTestPeer {
  return testPeerForLabel(`room-playground:${id}`);
}

export class PlaygroundSimulator {
  private sim: DeterministicSimulator;
  private readonly peerBinding: Record<PeerId, TicTacToeTestPeer>;
  private trust_map: Record<PeerId, number>;
  private entries: LogEntry[] = [];
  private next_id = 0;
  private listeners = new Set<() => void>();
  private readonly cheats: CheatController;

  constructor() {
    this.trust_map = { ...TRUST_MAP };
    this.peerBinding = {
      'player-x': playgroundPeer('player-x'),
      'player-o': playgroundPeer('player-o'),
      server: playgroundPeer('server'),
    };
    this.sim = this.createSim();
    this.cheats = createCheatController({
      getSim: () => this.sim,
      simPeer: (peerId) => this.simPeer(peerId),
      pushEntry: (fields) => this.pushEntry(fields),
      logNewEvents: (eventsBefore) => this.logNewEvents(eventsBefore),
      notify: () => this.notify(),
    });
  }

  /** Map UI peer label → simulator / `Room` peer id (Ed25519-derived). */
  private simPeer(p: PeerId): string {
    return this.peerBinding[p].peerId;
  }

  private labelForSimPeer(simPeerId: string): PeerId | null {
    for (const peerId of PEERS) {
      if (this.simPeer(peerId) === simPeerId) return peerId;
    }
    return null;
  }

  private createSim(): DeterministicSimulator {
    const initialMembership: Record<string, number> = {};
    const initialMemberPublicKeys: Record<string, string> = {};
    const peerSecretSeeds: Record<string, Uint8Array> = {};
    for (const p of PEERS) {
      const b = this.peerBinding[p]!;
      initialMembership[b.peerId] = this.trust_map[p];
      initialMemberPublicKeys[b.peerId] = b.publicKeyB64;
      peerSecretSeeds[b.peerId] = b.secretSeed;
    }
    return new DeterministicSimulator(TicTacToeModule, {
      topic: 'room-playground',
      initialMembership,
      initialMemberPublicKeys,
      roomSecret: 'room-playground-room',
      peerSecretSeeds,
      advanceTime: () => {
        /* browser playground has no fake timers */
      },
    });
  }

  dispatch(peerId: PeerId, message: Message): void {
    const eventsBefore = this.sim.getEventLog(this.simPeer('server')).length;
    const errorsBefore = this.sim.getErrorLog().length;
    this.sim.dispatch(this.simPeer(peerId), message);
    const errorsAfter = this.sim.getErrorLog().length;
    this.pushEntry({
      kind: 'action',
      tag: 'dispatch',
      summary: `${peerId} → ${message.type}`,
      code: `sim.dispatch('${peerId}', ${JSON.stringify(message)})`,
      peerId,
    });
    if (errorsAfter > errorsBefore) {
      const latestError = this.sim.getErrorLog()[errorsAfter - 1];
      if (latestError) {
        this.pushEntry({
          kind: 'effect',
          tag: 'rejected',
          summary: `rejected: ${latestError.type}${
            latestError.payload !== undefined
              ? ' ' + JSON.stringify(latestError.payload)
              : ''
          }`,
        });
      }
    }
    this.logNewEvents(eventsBefore);
    this.notify();
  }

  getState(peerId: PeerId): State {
    return this.sim.getState(this.simPeer(peerId));
  }

  getCommittedState(peerId: PeerId): State {
    return this.sim.getCommittedState(this.simPeer(peerId));
  }

  getEventLog(peerId: PeerId): Event[] {
    return this.sim.getEventLog(this.simPeer(peerId));
  }

  getLogicalTimeMs(): number {
    return this.sim.getLogicalTimeMs();
  }

  getClockSnapshot(peerId: PeerId = 'server'): SimClockSnapshot {
    const snap = this.sim.getClockSnapshot(this.simPeer(peerId));
    const active = snap.clockActivePlayer;
    return {
      clockStatus:
        snap.clockStatus === 'running' || snap.clockStatus === 'finished'
          ? snap.clockStatus
          : 'idle',
      remainingMsX:
        typeof snap.remainingMsX === 'number' && Number.isFinite(snap.remainingMsX)
          ? Math.max(0, snap.remainingMsX)
          : 0,
      remainingMsO:
        typeof snap.remainingMsO === 'number' && Number.isFinite(snap.remainingMsO)
          ? Math.max(0, snap.remainingMsO)
          : 0,
      clockActivePlayer: active === 'X' || active === 'O' ? active : null,
    };
  }

  getPeerCryptoSummary(): PeerCryptoSummary[] {
    return PEERS.map((label) => {
      const peer = this.peerBinding[label];
      return {
        label,
        peerId: peer.peerId,
        publicKeyB64: peer.publicKeyB64,
      };
    });
  }

  getTrustMap(): Record<PeerId, number> {
    return { ...this.trust_map };
  }

  getCurrentAuthorityLabel(): PeerId {
    let best: PeerId = PEERS[0]!;
    for (const peerId of PEERS) {
      const peerTrust = this.trust_map[peerId];
      const bestTrust = this.trust_map[best];
      if (peerTrust > bestTrust) {
        best = peerId;
      }
    }
    return best;
  }

  getWireAuthFailures(): string[] {
    return this.sim.getWireAuthFailures();
  }

  applyElectionRankings(rankings: ElectionRanking): void {
    const votes: TrustVote[] = [];
    for (const voter of PEERS) {
      const ranked = rankings[voter];
      const trustedPeer = ranked.find((candidate) => candidate !== voter) ?? voter;
      votes.push({
        from: this.simPeer(voter),
        trustedPeer: this.simPeer(trustedPeer),
      });
    }
    const elected = computeTrustMap(
      votes,
      PEERS.map((peerId) => this.simPeer(peerId)),
    );

    const nextTrustMap: Record<PeerId, number> = { ...this.trust_map };
    for (const [simPeerId, trust] of Object.entries(elected)) {
      const label = this.labelForSimPeer(simPeerId);
      if (!label) continue;
      nextTrustMap[label] = trust;
    }

    const previousAuthority = this.getCurrentAuthorityLabel();
    for (const peerId of PEERS) {
      this.dispatch(
        'server',
        PeerTrustUpdate({
          peerId: this.simPeer(peerId),
          trust: nextTrustMap[peerId],
        }),
      );
    }
    this.trust_map = nextTrustMap;
    const nextAuthority = this.getCurrentAuthorityLabel();
    this.pushEntry({
      kind: 'effect',
      tag: 'trust',
      summary: `election applied: authority ${previousAuthority} → ${nextAuthority}`,
    });
    this.notify();
  }

  pauseDelivery(): void {
    this.sim.pauseDelivery();
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: 'paused message delivery',
      code: 'sim.pauseDelivery()',
    });
    this.notify();
  }

  resumeDelivery(): void {
    this.sim.resumeDelivery();
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: 'resumed message delivery',
      code: 'sim.resumeDelivery()',
    });
    this.notify();
  }

  dropNextMessage(): void {
    this.sim.dropNextMessage();
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: 'dropped next queued message',
      code: 'sim.dropNextMessage()',
    });
    this.notify();
  }

  disconnectPeer(peerId: PeerId): void {
    this.sim.disconnectPeer(this.simPeer(peerId));
    this.pushEntry({
      kind: 'action',
      tag: 'disconnect',
      summary: `${peerId} disconnected`,
      code: `sim.disconnectPeer('${peerId}')`,
      peerId,
    });
    this.notify();
  }

  reconnectPeer(peerId: PeerId): void {
    this.sim.reconnectPeer(this.simPeer(peerId));
    this.pushEntry({
      kind: 'action',
      tag: 'reconnect',
      summary: `${peerId} reconnected + synced`,
      code: `sim.reconnectPeer('${peerId}')`,
      peerId,
    });
    this.notify();
  }

  advanceTime(ms: number, opts?: { silent?: boolean }): void {
    const eventsBefore = this.sim.getEventLog(this.simPeer('server')).length;
    const errorsBefore = this.sim.getErrorLog().length;
    this.sim.advanceTime(ms);
    this.sim.dispatch(this.simPeer('server'), TickClock({ elapsedMs: ms }));
    if (!opts?.silent) {
      this.pushEntry({
        kind: 'action',
        tag: 'network',
        summary: `advance time ${ms}ms + tick clock`,
        code: `sim.advanceTime(${ms}); sim.dispatch('server', TickClock({ elapsedMs: ${ms} }))`,
      });
    }
    const errorsAfter = this.sim.getErrorLog().length;
    if (errorsAfter > errorsBefore) {
      const latestError = this.sim.getErrorLog()[errorsAfter - 1];
      if (latestError) {
        if (!opts?.silent) {
          this.pushEntry({
            kind: 'effect',
            tag: 'rejected',
            summary: `rejected: ${latestError.type}`,
          });
        }
      }
    }
    this.logNewEvents(eventsBefore);
    this.notify();
  }

  getTimeoutLog() {
    return this.sim.getTimeoutLog();
  }

  getErrorLog() {
    return this.sim.getErrorLog();
  }

  getAuthorityChangeLog() {
    return this.sim.getAuthorityChangeLog();
  }

  getLog(): LogEntry[] {
    return [...this.entries];
  }

  isSpoofing(peerId: PeerId): boolean {
    return this.cheats.isSpoofing(peerId);
  }

  toggleSpoof(peerId: PeerId): void {
    this.cheats.toggleSpoof(peerId);
  }

  dispatchWithSpoof(peerId: PeerId, message: Message): void {
    if (this.cheats.dispatchWithSpoof(peerId, message)) return;
    this.dispatch(peerId, message);
  }

  cheatSpoofIdentity(attackerId: PeerId): void {
    this.cheats.cheatSpoofIdentity(attackerId);
  }

  cheatUnauthorizedTrustUpdate(attackerId: PeerId): void {
    this.cheats.cheatUnauthorizedTrustUpdate(attackerId);
  }

  cheatForceClockTick(attackerId: PeerId, elapsedMs: number): void {
    this.cheats.cheatForceClockTick(attackerId, elapsedMs);
  }

  cheatFabricateCommit(): void {
    this.cheats.cheatFabricateCommit();
  }

  cheatReplay(): void {
    this.cheats.cheatReplay();
  }

  cheatTamperEvents(): void {
    this.cheats.cheatTamperEvents();
  }

  cheatClearInterceptor(): void {
    this.cheats.cheatClearInterceptor();
  }

  cheatFlood(flooderId: PeerId): void {
    this.cheats.cheatFlood(flooderId);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  reset(): void {
    this.sim.destroy();
    this.trust_map = { ...TRUST_MAP };
    this.sim = this.createSim();
    this.entries = [];
    this.next_id = 0;
    this.cheats.reset();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  formatLogForClipboard(): string {
    const finalStates: Record<PeerId, State> = {
      'player-x': this.sim.getState(this.simPeer('player-x')),
      'player-o': this.sim.getState(this.simPeer('player-o')),
      server: this.sim.getState(this.simPeer('server')),
    };
    return formatLogForClipboard({
      entries: this.entries,
      errors: this.sim.getErrorLog(),
      authorityChanges: this.sim.getAuthorityChangeLog(),
      finalStates,
      serverEvents: this.sim.getEventLog(this.simPeer('server')),
    });
  }

  // ─── Private ──────────────────────────────────────────────────

  private pushEntry(fields: Omit<LogEntry, 'id'>) {
    this.entries.push({ id: this.next_id++, ...fields });
  }

  private logNewEvents(countBefore: number) {
    const events = this.sim.getEventLog(this.simPeer('server'));
    for (let i = countBefore; i < events.length; i++) {
      const ev = events[i]!;
      const raw = ev.payload;
      const payload =
        raw !== null && typeof raw === 'object' && !Array.isArray(raw)
          ? raw
          : undefined;
      this.pushEntry({
        kind: 'effect',
        tag: 'committed',
        summary: `committed: ${ev.type}${payload ? ' ' + JSON.stringify(payload) : ''}`,
      });
    }
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }
}
