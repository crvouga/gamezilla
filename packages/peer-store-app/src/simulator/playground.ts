import { ServerAuthority } from '@gamezilla/peer-store/server-authority'
import { DeterministicSimulator } from '@gamezilla/peer-store/simulator'
import { TicTacToeModule } from '@gamezilla/peer-store/__fixtures__/tic-tac-toe.module'
import type { Event, Message, State } from '@gamezilla/peer-store/types'

export const PEERS = ['player-x', 'player-o', 'server', 'observer'] as const
export type PeerId = (typeof PEERS)[number]

export type LogEntry = {
  id: number
  kind: 'action' | 'effect' | 'cheat'
  tag: string
  summary: string
  code?: string | undefined
  peerId?: string | undefined
  detected?: boolean | undefined
}

export class PlaygroundSimulator {
  private sim: DeterministicSimulator
  private entries: LogEntry[] = []
  private next_id = 0
  private listeners = new Set<() => void>()
  private spoofing_peers = new Set<PeerId>()

  constructor() {
    this.sim = this.createSim()
  }

  private createSim(): DeterministicSimulator {
    return new DeterministicSimulator(TicTacToeModule, {
      peers: [...PEERS],
      consensusTimeoutMs: 5000,
      syncPolicy: 'server',
      createAuthority: ({ peerId }) =>
        new ServerAuthority({ peerId, serverId: 'server' }),
    })
  }

  dispatch(peerId: PeerId, message: Message): void {
    const eventsBefore = this.sim.getEventLog('server').length
    this.sim.dispatch(peerId, message)
    this.pushEntry({
      kind: 'action',
      tag: 'dispatch',
      summary: `${peerId} → ${message.type}`,
      code: `sim.dispatch('${peerId}', ${JSON.stringify(message)})`,
      peerId,
    })
    this.logNewEvents(eventsBefore)
    this.notify()
  }

  getState(peerId: PeerId): State {
    return this.sim.getState(peerId)
  }

  getCommittedState(peerId: PeerId): State {
    return this.sim.getCommittedState(peerId)
  }

  getEventLog(peerId: PeerId): Event[] {
    return this.sim.getEventLog(peerId)
  }

  pauseDelivery(): void {
    this.sim.pauseDelivery()
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: 'paused message delivery',
      code: 'sim.pauseDelivery()',
    })
    this.notify()
  }

  resumeDelivery(): void {
    this.sim.resumeDelivery()
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: 'resumed message delivery',
      code: 'sim.resumeDelivery()',
    })
    this.notify()
  }

  dropNextMessage(): void {
    this.sim.dropNextMessage()
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: 'dropped next queued message',
      code: 'sim.dropNextMessage()',
    })
    this.notify()
  }

  disconnectPeer(peerId: PeerId): void {
    this.sim.disconnectPeer(peerId)
    this.pushEntry({
      kind: 'action',
      tag: 'disconnect',
      summary: `${peerId} disconnected`,
      code: `sim.disconnectPeer('${peerId}')`,
      peerId,
    })
    this.notify()
  }

  reconnectPeer(peerId: PeerId): void {
    this.sim.reconnectPeer(peerId)
    this.pushEntry({
      kind: 'action',
      tag: 'reconnect',
      summary: `${peerId} reconnected + synced`,
      code: `sim.reconnectPeer('${peerId}')`,
      peerId,
    })
    this.notify()
  }

  advanceTime(ms: number): void {
    this.pushEntry({
      kind: 'action',
      tag: 'network',
      summary: `advance time ${ms}ms (not available in browser)`,
      code: `sim.advanceTime(${ms})`,
    })
    this.notify()
  }

  getBadActorLog() {
    return this.sim.getBadActorLog()
  }

  getTimeoutLog() {
    return this.sim.getTimeoutLog()
  }

  getErrorLog() {
    return this.sim.getErrorLog()
  }

  getLog(): LogEntry[] {
    return [...this.entries]
  }

  isSpoofing(peerId: PeerId): boolean {
    return this.spoofing_peers.has(peerId)
  }

  toggleSpoof(peerId: PeerId): void {
    if (this.spoofing_peers.has(peerId)) {
      this.spoofing_peers.delete(peerId)
      this.pushEntry({
        kind: 'effect',
        tag: 'cheat',
        summary: `${peerId} spoof mode OFF`,
        peerId,
      })
    } else {
      this.spoofing_peers.add(peerId)
      this.pushEntry({
        kind: 'effect',
        tag: 'cheat',
        summary: `${peerId} spoof mode ON — moves will use wrong identity`,
        peerId,
      })
    }
    this.notify()
  }

  dispatchWithSpoof(peerId: PeerId, message: Message): void {
    if (this.spoofing_peers.has(peerId) && message.type === 'PLACE_MARK') {
      const payload = message.payload as Record<string, unknown>
      const spoofedPlayer = payload['player'] === 'X' ? 'O' : 'X'
      const spoofedMessage: Message = {
        ...message,
        payload: { ...payload, player: spoofedPlayer },
      }
      const eventsBefore = this.sim.getEventLog('server').length
      try {
        this.sim.dispatch(peerId, spoofedMessage)
      } catch {
        this.pushEntry({
          kind: 'cheat',
          tag: 'cheat',
          summary: `${peerId} spoofed as ${spoofedPlayer} — rejected`,
          code: `sim.dispatch('${peerId}', ${JSON.stringify(spoofedMessage)})`,
          peerId,
          detected: true,
        })
        this.notify()
        return
      }
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: `${peerId} spoofed as ${spoofedPlayer} — accepted`,
        code: `sim.dispatch('${peerId}', ${JSON.stringify(spoofedMessage)})`,
        peerId,
        detected: false,
      })
      this.logNewEvents(eventsBefore)
      this.notify()
      return
    }
    this.dispatch(peerId, message)
  }

  // ─── Cheat scenarios ───────────────────────────────────────────

  cheatSpoofIdentity(attackerId: PeerId): void {
    const spoofedPlayer = attackerId === 'player-x' ? 'O' : 'X'
    const message: Message = {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: spoofedPlayer },
    }
    try {
      this.sim.dispatch(attackerId, message)
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: `${attackerId} played as ${spoofedPlayer} — server accepted`,
        code: `sim.dispatch('${attackerId}', ${JSON.stringify(message)})`,
        peerId: attackerId,
        detected: false,
      })
    } catch {
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: `${attackerId} spoofed as ${spoofedPlayer} — rejected`,
        code: `sim.dispatch('${attackerId}', ${JSON.stringify(message)})`,
        peerId: attackerId,
        detected: true,
      })
    }
    this.notify()
  }

  cheatFabricateCommit(): void {
    const errorsBefore = this.sim.getErrorLog().length
    const wireMsg = {
      kind: 'committed',
      commandId: `fabricated-${Date.now()}`,
      events: [
        { type: 'MARK_PLACED', payload: { cell: 0, player: 'X', seq: 99 } },
      ],
    }
    this.sim.injectWireMessage(wireMsg)
    const detected = this.sim.getErrorLog().length > errorsBefore
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: detected
        ? 'fabricated commit was rejected'
        : 'fabricated commit was accepted by all peers',
      code: `sim.injectWireMessage(${JSON.stringify(wireMsg)})`,
      peerId: 'wire',
      detected,
    })
    this.notify()
  }

  cheatReplay(): void {
    const events = this.sim.getEventLog('server')
    if (events.length === 0) {
      this.pushEntry({
        kind: 'cheat',
        tag: 'cheat',
        summary: 'replay failed — no events to replay',
        peerId: 'wire',
        detected: false,
      })
      this.notify()
      return
    }
    const wireMsg = {
      kind: 'committed',
      commandId: `replay-${Date.now()}`,
      events: [...events],
    }
    this.sim.injectWireMessage(wireMsg)
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: `replayed ${events.length} event(s) with new commandId`,
      code: `sim.injectWireMessage(${JSON.stringify(wireMsg)})`,
      peerId: 'wire',
      detected: false,
    })
    this.notify()
  }

  cheatTamperEvents(): void {
    this.sim.setMessageInterceptor((_topic, payload) => {
      const msg = payload as Record<string, unknown>
      if (msg['kind'] === 'committed') {
        const events = msg['events'] as Array<Record<string, unknown>>
        return {
          ...msg,
          events: events.map((e) => {
            if (e['type'] === 'MARK_PLACED') {
              const p = e['payload'] as Record<string, unknown>
              const originalCell = p['cell'] as number
              const newCell = (originalCell + 4) % 9
              return { ...e, payload: { ...p, cell: newCell } }
            }
            return e
          }),
        }
      }
      return payload
    })
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: 'MITM interceptor active — committed events will have cells shifted by +4',
      code: [
        'sim.setMessageInterceptor((_topic, payload) => {',
        '  const msg = payload as Record<string, unknown>',
        '  if (msg["kind"] === "committed") {',
        '    const events = msg["events"] as Array<Record<string, unknown>>',
        '    return { ...msg, events: events.map((e) => {',
        '      if (e["type"] === "MARK_PLACED") {',
        '        const p = e["payload"] as Record<string, unknown>',
        '        return { ...e, payload: { ...p, cell: ((p["cell"] as number) + 4) % 9 } }',
        '      }',
        '      return e',
        '    }) }',
        '  }',
        '  return payload',
        '})',
      ].join('\n'),
      peerId: 'wire',
      detected: false,
    })
    this.notify()
  }

  cheatClearInterceptor(): void {
    this.sim.setMessageInterceptor(null)
    this.pushEntry({
      kind: 'action',
      tag: 'cheat',
      summary: 'interceptor cleared',
      code: 'sim.setMessageInterceptor(null)',
      peerId: 'wire',
    })
    this.notify()
  }

  cheatFlood(flooderId: PeerId): void {
    let accepted = 0
    let rejected = 0
    for (let i = 0; i < 20; i++) {
      try {
        this.sim.dispatch(flooderId, {
          type: 'PLACE_MARK',
          payload: { cell: i % 9, player: i % 2 === 0 ? 'X' : 'O' },
        })
        accepted++
      } catch {
        rejected++
      }
    }
    this.pushEntry({
      kind: 'cheat',
      tag: 'cheat',
      summary: `flood from ${flooderId}: ${accepted} accepted, ${rejected} rejected`,
      code: `// flood: 20x dispatch from '${flooderId}' with alternating X/O\nfor (let i = 0; i < 20; i++) {\n  try {\n    sim.dispatch('${flooderId}', { type: 'PLACE_MARK', payload: { cell: i % 9, player: i % 2 === 0 ? 'X' : 'O' } })\n  } catch {}\n}`,
      peerId: flooderId,
      detected: rejected > 0,
    })
    this.notify()
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  reset(): void {
    this.sim.destroy()
    this.sim = this.createSim()
    this.entries = []
    this.next_id = 0
    this.spoofing_peers.clear()
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  formatLogForClipboard(): string {
    const lines: string[] = []

    lines.push('## Peer-Store Playground Session')
    lines.push('')
    lines.push('Setup:')
    lines.push(`  peers: ${JSON.stringify([...PEERS])}`)
    lines.push('  syncPolicy: "server"')
    lines.push('  serverId: "server"')
    lines.push('  module: TicTacToeModule')
    lines.push('')
    lines.push('Steps:')

    let step = 0
    for (const entry of this.entries) {
      step++
      const prefix = `  ${step}.`
      if (entry.code) {
        const codeLines = entry.code.split('\n')
        if (codeLines.length === 1) {
          lines.push(`${prefix} ${entry.code}`)
        } else {
          lines.push(`${prefix} ${codeLines[0]}`)
          for (let i = 1; i < codeLines.length; i++) {
            lines.push(`     ${codeLines[i]}`)
          }
        }
      } else {
        lines.push(`${prefix} // ${entry.summary}`)
      }
      if (entry.kind === 'cheat') {
        const status = entry.detected ? 'CAUGHT' : 'UNDETECTED'
        lines.push(`     // → [${status}] ${entry.summary}`)
      }
    }

    lines.push('')
    lines.push('Errors:')
    const errors = this.sim.getErrorLog()
    if (errors.length === 0) {
      lines.push('  (none)')
    } else {
      for (const err of errors) {
        lines.push(`  - { code: '${err.code}', message: '${err.message}' }`)
      }
    }

    const badActors = this.sim.getBadActorLog()
    if (badActors.length > 0) {
      lines.push('')
      lines.push('Bad actors:')
      for (const ba of badActors) {
        lines.push(`  - ${ba.peerId} (commandId: ${ba.commandId})`)
      }
    }

    lines.push('')
    lines.push('Final states:')
    for (const peerId of PEERS) {
      lines.push(`  ${peerId}: ${JSON.stringify(this.sim.getState(peerId))}`)
    }

    lines.push('')
    lines.push('Committed events (server):')
    const serverEvents = this.sim.getEventLog('server')
    if (serverEvents.length === 0) {
      lines.push('  (none)')
    } else {
      for (const ev of serverEvents) {
        lines.push(`  - ${ev.type} ${JSON.stringify(ev.payload)}`)
      }
    }

    return lines.join('\n')
  }

  // ─── Private ──────────────────────────────────────────────────

  private pushEntry(fields: Omit<LogEntry, 'id'>) {
    this.entries.push({ id: this.next_id++, ...fields })
  }

  private logNewEvents(countBefore: number) {
    const events = this.sim.getEventLog('server')
    for (let i = countBefore; i < events.length; i++) {
      const ev = events[i]!
      const payload = ev.payload as Record<string, unknown> | undefined
      this.pushEntry({
        kind: 'effect',
        tag: 'committed',
        summary: `committed: ${ev.type}${payload ? ' ' + JSON.stringify(payload) : ''}`,
      })
    }
  }

  private notify() {
    for (const fn of this.listeners) fn()
  }
}
