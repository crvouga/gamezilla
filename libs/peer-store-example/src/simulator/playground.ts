import { Assert } from '@gamezilla/lib/assert';
import {
  MarkPlaced,
  PlaceMark,
  TicTacToeModule,
} from '@gamezilla/peer-store/testing/tic-tac-toe';
import { DeterministicSimulator } from '@gamezilla/peer-store/simulator';
import type { Event, Message, State } from '@gamezilla/peer-store/types';
import { isSystemEvent } from '@gamezilla/peer-store/utils';
import {
  TRUST_MAP,
  type LogEntry,
  type PeerId,
} from './playground-types';
import { formatLogForClipboard } from './playground-format';

export {
  PEERS,
  TRUST_MAP,
  type CheatLogEntry,
  type LogEntry,
  type MessageLogEntry,
  type PeerId,
} from './playground-types';

const crash: Assert = Assert.crash();

function wireRecord(payload: unknown): Record<string, unknown> {
  crash.record(payload, 'wire payload must be a plain object');
  return payload;
}

export class PlaygroundSimulator {
  private sim: DeterministicSimulator;
  private entries: LogEntry[] = [];
  private next_id = 0;
  private listeners = new Set<() => void>();
  private spoofing_peers = new Set<PeerId>();

  constructor() {
    this.sim = this.createSim();
  }

  private createSim(): DeterministicSimulator {
    return new DeterministicSimulator(TicTacToeModule, {
      topic: 'peer-store-playground',
      initialMembership: { ...TRUST_MAP },
      advanceTime: () => {
        /* browser playground has no fake timers */
      },
    });
  }

  dispatch(peerId: PeerId, message: Message): void {
    const eventsBefore = this.sim.getEventLog('server').length;
    this.sim.dispatch(peerId, message);
    this.pushEntry({
      kind: 'action',
      tag: 'dispatch',
      summary: `${peerId} → ${message.type}`,
      code: `sim.dispatch('${peerId}', ${JSON.stringify(message)})`,
      peerId,
    });
    this.logNewEvents(eventsBefore);
    this.notify();
  }

  getState(peerId: PeerId): State {
    return this.sim.getState(peerId);
  }

  getCommittedState(peerId: PeerId): State {
    return this.sim.getCommittedState(peerId);
  }

  getEventLog(peerId: PeerId): Event[] {
    return this.sim.getEventLog(peerId);
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
    this.sim.disconnectPeer(peerId);
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
    this.sim.reconnectPeer(peerId);
    this.pushEntry({
      kind: 'action',
      tag: 'reconnect',
      summary: `${peerId} reconnected + synced`,
      code: `sim.reconnectPeer('${peerId}')`,
      peerId,
    });
    this.notify();
  }

  advanceTime(ms: number): void {
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: `advance time ${ms}ms (not available in browser)`,
      code: `sim.advanceTime(${ms})`,
    });
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
    return this.spoofing_peers.has(peerId);
  }

  toggleSpoof(peerId: PeerId): void {
    if (this.spoofing_peers.has(peerId)) {
      this.spoofing_peers.delete(peerId);
      this.pushEntry({
        kind: 'effect',
        tag: 'cheat',
        summary: `${peerId} spoof mode OFF`,
        peerId,
      });
    } else {
      this.spoofing_peers.add(peerId);
      this.pushEntry({
        kind: 'effect',
        tag: 'cheat',
        summary: `${peerId} spoof mode ON — moves will use wrong identity`,
        peerId,
      });
    }
    this.notify();
  }

  dispatchWithSpoof(peerId: PeerId, message: Message): void {
    if (this.spoofing_peers.has(peerId) && message.type === PlaceMark.type) {
      const payload = wireRecord(message.payload);
      const spoofedPlayer = payload['player'] === 'X' ? 'O' : 'X';
      const spoofedMessage: Message = {
        ...message,
        payload: { ...payload, player: spoofedPlayer },
      };
      const eventsBefore = this.sim.getEventLog('server').length;
      try {
        this.sim.dispatch(peerId, spoofedMessage);
      } catch {
        this.pushEntry({
          kind: 'cheat',
          tag: 'cheat',
          summary: `${peerId} spoofed as ${spoofedPlayer} — rejected`,
          code: `sim.dispatch('${peerId}', ${JSON.stringify(spoofedMessage)})`,
          peerId,
          detected: true,
        });
        this.notify();
        return;
      }
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: `${peerId} spoofed as ${spoofedPlayer} — accepted`,
        code: `sim.dispatch('${peerId}', ${JSON.stringify(spoofedMessage)})`,
        peerId,
        detected: false,
      });
      this.logNewEvents(eventsBefore);
      this.notify();
      return;
    }
    this.dispatch(peerId, message);
  }

  // ─── Cheat scenarios ───────────────────────────────────────────

  cheatSpoofIdentity(attackerId: PeerId): void {
    const spoofedPlayer = attackerId === 'player-x' ? 'O' : 'X';
    const message: Message = PlaceMark({
      cell: 4,
      player: spoofedPlayer as 'X' | 'O',
    });
    try {
      this.sim.dispatch(attackerId, message);
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: `${attackerId} played as ${spoofedPlayer} — authority accepted`,
        code: `sim.dispatch('${attackerId}', ${JSON.stringify(message)})`,
        peerId: attackerId,
        detected: false,
      });
    } catch {
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: `${attackerId} spoofed as ${spoofedPlayer} — rejected`,
        code: `sim.dispatch('${attackerId}', ${JSON.stringify(message)})`,
        peerId: attackerId,
        detected: true,
      });
    }
    this.notify();
  }

  cheatFabricateCommit(): void {
    const errorsBefore = this.sim.getErrorLog().length;
    const nextSeq = this.sim.getLatestSeq('server') + 1;
    const wireMsg = {
      kind: 'accepted',
      commandId: `fabricated-${Date.now()}`,
      entries: [
        {
          seq: nextSeq,
          event: MarkPlaced({ cell: 0, player: 'X', seq: 99 }),
        },
      ],
    };
    this.sim.injectWireMessage(wireMsg);
    const detected = this.sim.getErrorLog().length > errorsBefore;
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: detected
        ? 'fabricated commit was rejected'
        : 'fabricated commit was accepted by all peers',
      code: `sim.injectWireMessage(${JSON.stringify(wireMsg)})`,
      peerId: 'wire',
      detected,
    });
    this.notify();
  }

  cheatReplay(): void {
    const domain = this.sim
      .getCommittedLogEntries('server')
      .filter((e) => !isSystemEvent(e.event));
    if (domain.length === 0) {
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: 'replay failed — no events to replay',
        peerId: 'wire',
        detected: false,
      });
      this.notify();
      return;
    }
    const start = this.sim.getLatestSeq('server') + 1;
    const entries = domain.map((e, i) => ({
      seq: start + i,
      event: e.event,
    }));
    const wireMsg = {
      kind: 'accepted',
      commandId: `replay-${Date.now()}`,
      entries,
    };
    this.sim.injectWireMessage(wireMsg);
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: `replayed ${domain.length} event(s) with new commandId`,
      code: `sim.injectWireMessage(${JSON.stringify(wireMsg)})`,
      peerId: 'wire',
      detected: false,
    });
    this.notify();
  }

  cheatTamperEvents(): void {
    this.sim.setMessageInterceptor((_topic, payload) => {
      if (
        payload === null ||
        typeof payload !== 'object' ||
        Array.isArray(payload)
      ) {
        return payload;
      }
      const msg = wireRecord(payload);
      if (msg['kind'] !== 'accepted') return payload;
      const entriesRaw = msg['entries'];
      crash.array(entriesRaw, 'accepted.entries must be an array');
      const newEntries = entriesRaw.map((row) => {
        crash.record(row, 'log entry must be object');
        const seq = row['seq'];
        crash.number(seq, 'entry.seq must be number');
        const event = row['event'];
        crash.record(event, 'entry.event must be object');
        const type = event['type'];
        if (type !== MarkPlaced.type) return row;
        const p = event['payload'];
        crash.record(p, 'MARK_PLACED payload must be object');
        const cellRaw = p['cell'];
        crash.number(cellRaw, 'cell must be number');
        const newCell = (cellRaw + 4) % 9;
        return {
          seq,
          event: {
            ...event,
            payload: { ...p, cell: newCell },
          },
        };
      });
      return { ...msg, entries: newEntries };
    });
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary:
        'MITM interceptor active — accepted entries will have cells shifted by +4',
      code: [
        'sim.setMessageInterceptor((_topic, payload) => {',
        '  const msg = payload as Record<string, unknown>',
        '  if (msg["kind"] === "accepted") {',
        '    const entries = msg["entries"] as Array<{ seq: number; event: Record<string, unknown> }>',
        '    return { ...msg, entries: entries.map((row) => {',
        '      const e = row.event',
        `      if (e["type"] === "${MarkPlaced.type}") {`,
        '        const p = e["payload"] as Record<string, unknown>',
        '        return { seq: row.seq, event: { ...e, payload: { ...p, cell: ((p["cell"] as number) + 4) % 9 } } }',
        '      }',
        '      return row',
        '    }) }',
        '  }',
        '  return payload',
        '})',
      ].join('\n'),
      peerId: 'wire',
      detected: false,
    });
    this.notify();
  }

  cheatClearInterceptor(): void {
    this.sim.setMessageInterceptor(null);
    this.pushEntry({
      kind: 'action',
      tag: 'cheat',
      summary: 'interceptor cleared',
      code: 'sim.setMessageInterceptor(null)',
      peerId: 'wire',
    });
    this.notify();
  }

  cheatFlood(flooderId: PeerId): void {
    let accepted = 0;
    let rejected = 0;
    for (let i = 0; i < 20; i++) {
      try {
        this.sim.dispatch(
          flooderId,
          PlaceMark({
            cell: i % 9,
            player: (i % 2 === 0 ? 'X' : 'O') as 'X' | 'O',
          }),
        );
        accepted++;
      } catch {
        rejected++;
      }
    }
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: `flood from ${flooderId}: ${accepted} accepted, ${rejected} rejected`,
      code: `// flood: 20x dispatch from '${flooderId}' with alternating X/O\nimport { PlaceMark } from '@gamezilla/peer-store/testing/tic-tac-toe'\nfor (let i = 0; i < 20; i++) {\n  try {\n    sim.dispatch('${flooderId}', PlaceMark({ cell: i % 9, player: (i % 2 === 0 ? 'X' : 'O') as 'X' | 'O' }))\n  } catch {}\n}`,
      peerId: flooderId,
      detected: rejected > 0,
    });
    this.notify();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  reset(): void {
    this.sim.destroy();
    this.sim = this.createSim();
    this.entries = [];
    this.next_id = 0;
    this.spoofing_peers.clear();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  formatLogForClipboard(): string {
    const finalStates: Record<PeerId, State> = {
      'player-x': this.sim.getState('player-x'),
      'player-o': this.sim.getState('player-o'),
      server: this.sim.getState('server'),
      observer: this.sim.getState('observer'),
    };
    return formatLogForClipboard({
      entries: this.entries,
      errors: this.sim.getErrorLog(),
      authorityChanges: this.sim.getAuthorityChangeLog(),
      finalStates,
      serverEvents: this.sim.getEventLog('server'),
    });
  }

  // ─── Private ──────────────────────────────────────────────────

  private pushEntry(fields: Omit<LogEntry, 'id'>) {
    this.entries.push({ id: this.next_id++, ...fields });
  }

  private logNewEvents(countBefore: number) {
    const events = this.sim.getEventLog('server');
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
