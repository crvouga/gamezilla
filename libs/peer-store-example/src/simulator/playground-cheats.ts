import { Assert } from '@gamezilla/lib/assert';
import { PeerTrustUpdate } from '@gamezilla/peer-store/system-messages';
import {
  MarkPlaced,
  PlaceMark,
  TickClock,
} from '@gamezilla/peer-store/testkit/tic-tac-toe';
import type { DeterministicSimulator } from '@gamezilla/peer-store/simulator';
import type { Message } from '@gamezilla/peer-store/types';
import { isSystemEvent } from '@gamezilla/peer-store/utils';
import type { LogEntry, PeerId } from './playground-types';

const crash: Assert = Assert.crash();

function wireRecord(payload: unknown): Record<string, unknown> {
  crash.record(payload, 'wire payload must be a plain object');
  return payload;
}

type CheatContext = {
  getSim: () => DeterministicSimulator;
  simPeer: (peerId: PeerId) => string;
  pushEntry: (fields: Omit<LogEntry, 'id'>) => void;
  logNewEvents: (eventsBefore: number) => void;
  notify: () => void;
};

export type CheatController = {
  isSpoofing: (peerId: PeerId) => boolean;
  toggleSpoof: (peerId: PeerId) => void;
  dispatchWithSpoof: (peerId: PeerId, message: Message) => boolean;
  cheatSpoofIdentity: (attackerId: PeerId) => void;
  cheatUnauthorizedTrustUpdate: (attackerId: PeerId) => void;
  cheatForceClockTick: (attackerId: PeerId, elapsedMs: number) => void;
  cheatFabricateCommit: () => void;
  cheatReplay: () => void;
  cheatTamperEvents: () => void;
  cheatClearInterceptor: () => void;
  cheatFlood: (flooderId: PeerId) => void;
  reset: () => void;
};

export function createCheatController(ctx: CheatContext): CheatController {
  return new CheatControllerImpl(ctx);
}

class CheatControllerImpl implements CheatController {
  private readonly spoofingPeers = new Set<PeerId>();

  constructor(private readonly ctx: CheatContext) {}

  private sim(): DeterministicSimulator {
    return this.ctx.getSim();
  }

  isSpoofing(peerId: PeerId): boolean {
    return this.spoofingPeers.has(peerId);
  }

  toggleSpoof(peerId: PeerId): void {
    if (this.spoofingPeers.has(peerId)) {
      this.spoofingPeers.delete(peerId);
      this.ctx.pushEntry({ kind: 'effect', tag: 'cheat', summary: `${peerId} spoof mode OFF`, peerId });
    } else {
      this.spoofingPeers.add(peerId);
      this.ctx.pushEntry({
        kind: 'effect',
        tag: 'cheat',
        summary: `${peerId} spoof mode ON — moves will use wrong identity`,
        peerId,
      });
    }
    this.ctx.notify();
  }

  dispatchWithSpoof(peerId: PeerId, message: Message): boolean {
    if (!this.spoofingPeers.has(peerId) || message.type !== PlaceMark.type) return false;
    const spoofedMessage = this.buildSpoofedMessage(message);
    const eventsBefore = this.sim().getEventLog(this.ctx.simPeer('server')).length;
    try {
      this.sim().dispatch(this.ctx.simPeer(peerId), spoofedMessage.message);
      this.logSpoofResult(peerId, spoofedMessage.player, spoofedMessage.message, false);
      this.ctx.logNewEvents(eventsBefore);
    } catch {
      this.logSpoofResult(peerId, spoofedMessage.player, spoofedMessage.message, true);
    }
    this.ctx.notify();
    return true;
  }

  cheatSpoofIdentity(attackerId: PeerId): void {
    const spoofedPlayer = attackerId === 'player-x' ? 'O' : 'X';
    const message: Message = PlaceMark({ cell: 4, player: spoofedPlayer as 'X' | 'O' });
    try {
      this.sim().dispatch(this.ctx.simPeer(attackerId), message);
      this.logOutcome({
        peerId: attackerId,
        tag: 'cheat',
        summary: `${attackerId} played as ${spoofedPlayer} — accepted`,
        message,
        detected: false,
      });
    } catch {
      this.logOutcome({
        peerId: attackerId,
        tag: 'cheat',
        summary: `${attackerId} spoofed as ${spoofedPlayer} — blocked by crypto/auth`,
        message,
        detected: true,
      });
    }
    this.ctx.notify();
  }

  cheatUnauthorizedTrustUpdate(attackerId: PeerId): void {
    const target = attackerId === 'player-x' ? 'player-o' : 'player-x';
    const message = PeerTrustUpdate({ peerId: this.ctx.simPeer(target), trust: 9 });
    const detected = this.dispatchAndDetect(attackerId, message);
    this.ctx.pushEntry({
      kind: 'cheat',
      tag: 'identity',
      summary: detected
        ? `${attackerId} tried trust_update as non-authority — blocked by crypto/auth`
        : `${attackerId} changed trust without authority — accepted`,
      code: `sim.dispatch('${attackerId}', PeerTrustUpdate({ peerId: '${target}', trust: 9 }))`,
      peerId: attackerId,
      detected,
    });
    this.ctx.notify();
  }

  cheatForceClockTick(attackerId: PeerId, elapsedMs: number): void {
    const message = TickClock({ elapsedMs });
    const detected = this.dispatchAndDetect(attackerId, message);
    this.ctx.pushEntry({
      kind: 'cheat',
      tag: 'integrity',
      summary: detected
        ? `${attackerId} forced TickClock(${elapsedMs}) — blocked by crypto/auth`
        : `${attackerId} forced TickClock(${elapsedMs}) — accepted`,
      code: `sim.dispatch('${attackerId}', TickClock({ elapsedMs: ${elapsedMs} }))`,
      peerId: attackerId,
      detected,
    });
    this.ctx.notify();
  }

  cheatFabricateCommit(): void {
    const errorsBefore = this.sim().getErrorLog().length;
    const nextSeq = this.sim().getLatestSeq(this.ctx.simPeer('server')) + 1;
    const wireMsg = { kind: 'accepted', commandId: `fabricated-${Date.now()}`, entries: [{ seq: nextSeq, event: MarkPlaced({ cell: 0, player: 'X', seq: 99 }) }] };
    this.sim().injectWireMessage(wireMsg);
    const detected = this.sim().getErrorLog().length > errorsBefore;
    this.ctx.pushEntry({ kind: 'cheat', tag: 'cheat', summary: detected ? 'fabricated commit was blocked by crypto/integrity checks' : 'fabricated commit bypassed integrity checks', code: `sim.injectWireMessage(${JSON.stringify(wireMsg)})`, peerId: 'wire', detected });
    this.ctx.notify();
  }

  cheatReplay(): void {
    const domain = this.sim().getCommittedLogEntries(this.ctx.simPeer('server')).filter((e) => !isSystemEvent(e.event));
    if (domain.length === 0) {
      this.ctx.pushEntry({ kind: 'cheat', tag: 'cheat', summary: 'replay failed — no events to replay', peerId: 'wire', detected: false });
      this.ctx.notify();
      return;
    }
    const start = this.sim().getLatestSeq(this.ctx.simPeer('server')) + 1;
    const wireMsg = { kind: 'accepted', commandId: `replay-${Date.now()}`, entries: domain.map((e, i) => ({ seq: start + i, event: e.event })) };
    const errorsBefore = this.sim().getErrorLog().length;
    this.sim().injectWireMessage(wireMsg);
    const detected = this.sim().getErrorLog().length > errorsBefore;
    this.ctx.pushEntry({ kind: 'cheat', tag: 'replay', summary: detected ? `replay ${domain.length} event(s) — blocked by crypto/integrity checks` : `replay ${domain.length} event(s) — accepted`, code: `sim.injectWireMessage(${JSON.stringify(wireMsg)})`, peerId: 'wire', detected });
    this.ctx.notify();
  }

  cheatTamperEvents(): void {
    this.sim().setMessageInterceptor((_topic, payload) => this.tamperPayload(payload));
    this.ctx.pushEntry({ kind: 'cheat', tag: 'cheat', summary: 'MITM interceptor active — accepted entries will have cells shifted by +4', code: 'sim.setMessageInterceptor(...)', peerId: 'wire', detected: false });
    this.ctx.notify();
  }

  cheatClearInterceptor(): void {
    this.sim().setMessageInterceptor(null);
    this.ctx.pushEntry({ kind: 'action', tag: 'cheat', summary: 'interceptor cleared', code: 'sim.setMessageInterceptor(null)', peerId: 'wire' });
    this.ctx.notify();
  }

  cheatFlood(flooderId: PeerId): void {
    let accepted = 0;
    let rejected = 0;
    for (let i = 0; i < 20; i++) {
      try {
        this.sim().dispatch(this.ctx.simPeer(flooderId), PlaceMark({ cell: i % 9, player: (i % 2 === 0 ? 'X' : 'O') as 'X' | 'O' }));
        accepted++;
      } catch {
        rejected++;
      }
    }
    this.ctx.pushEntry({ kind: 'cheat', tag: 'cheat', summary: `flood from ${flooderId}: ${accepted} accepted, ${rejected} rejected`, code: `sim.cheatFlood('${flooderId}')`, peerId: flooderId, detected: rejected > 0 });
    this.ctx.notify();
  }

  reset(): void {
    this.spoofingPeers.clear();
  }

  private buildSpoofedMessage(message: Message): { player: 'X' | 'O'; message: Message } {
    const payload = wireRecord(message.payload);
    const spoofedPlayer = payload['player'] === 'X' ? 'O' : 'X';
    return {
      player: spoofedPlayer,
      message: { ...message, payload: { ...payload, player: spoofedPlayer } },
    };
  }

  private logSpoofResult(peerId: PeerId, spoofedPlayer: string, spoofedMessage: Message, detected: boolean): void {
    this.ctx.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: `${peerId} spoofed as ${spoofedPlayer} — ${detected ? 'blocked by crypto/auth' : 'accepted'}`,
      code: `sim.dispatch('${peerId}', ${JSON.stringify(spoofedMessage)})`,
      peerId,
      detected,
    });
  }

  private dispatchAndDetect(peerId: PeerId, message: Message): boolean {
    const errorsBefore = this.sim().getErrorLog().length;
    try {
      this.sim().dispatch(this.ctx.simPeer(peerId), message);
    } catch {}
    return this.sim().getErrorLog().length > errorsBefore;
  }

  private logOutcome(input: {
    peerId: PeerId;
    tag: string;
    summary: string;
    message: Message;
    detected: boolean;
  }): void {
    this.ctx.pushEntry({
      kind: 'cheat',
      tag: input.tag,
      summary: input.summary,
      code: `sim.dispatch('${input.peerId}', ${JSON.stringify(input.message)})`,
      peerId: input.peerId,
      detected: input.detected,
    });
  }

  private tamperPayload(payload: unknown): unknown {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }
    const msg = wireRecord(payload);
    if (msg['kind'] !== 'accepted') return payload;
    const entriesRaw = msg['entries'];
    crash.array(entriesRaw, 'accepted.entries must be an array');
    return { ...msg, entries: entriesRaw.map((row) => this.tamperEntry(row)) };
  }

  private tamperEntry(row: unknown): unknown {
    crash.record(row, 'log entry must be object');
    const seq = row['seq'];
    crash.number(seq, 'entry.seq must be number');
    const event = row['event'];
    crash.record(event, 'entry.event must be object');
    if (event['type'] !== MarkPlaced.type) return row;
    const p = event['payload'];
    crash.record(p, 'MARK_PLACED payload must be object');
    const cellRaw = p['cell'];
    crash.number(cellRaw, 'cell must be number');
    return { seq, event: { ...event, payload: { ...p, cell: (cellRaw + 4) % 9 } } };
  }
}
