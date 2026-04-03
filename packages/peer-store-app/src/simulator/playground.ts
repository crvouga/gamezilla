import { ServerAuthority } from '@gamezilla/peer-store/server-authority'
import { DeterministicSimulator } from '@gamezilla/peer-store/simulator'
import { TicTacToeModule } from '@gamezilla/peer-store/__fixtures__/tic-tac-toe.module'
import type { Event, Message, State } from '@gamezilla/peer-store/types'

export const PEERS = ['player-x', 'player-o', 'server', 'observer'] as const
export type PeerId = (typeof PEERS)[number]

export type MessageLogEntry = {
  id: number
  timestamp: number
  from: PeerId | 'system'
  kind: 'command' | 'vote' | 'commit' | 'timeout' | 'error' | 'cheat'
  summary: string
}

export type CheatLogEntry = {
  id: number
  timestamp: number
  scenario: string
  detected: boolean
  detail: string
  peerId?: PeerId | 'wire' | undefined
}

export class PlaygroundSimulator {
  private sim: DeterministicSimulator
  private message_log: MessageLogEntry[] = []
  private cheat_log: CheatLogEntry[] = []
  private next_id = 0
  private next_cheat_id = 0
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
    this.sim.dispatch(peerId, message)
    this.log(peerId, 'command', `${message.type}`)
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
    this.notify()
  }

  resumeDelivery(): void {
    this.sim.resumeDelivery()
    this.notify()
  }

  dropNextMessage(): void {
    this.sim.dropNextMessage()
    this.log('server', 'error', 'dropped message')
    this.notify()
  }

  disconnectPeer(peerId: PeerId): void {
    this.sim.disconnectPeer(peerId)
    this.log(peerId, 'error', `${peerId} disconnected`)
    this.notify()
  }

  reconnectPeer(peerId: PeerId): void {
    this.sim.reconnectPeer(peerId)
    this.log(peerId, 'commit', `${peerId} reconnected + synced`)
    this.notify()
  }

  advanceTime(_ms: number): void {
    this.log('server', 'timeout', `advance time not available in browser`)
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

  getMessageLog(): MessageLogEntry[] {
    return [...this.message_log]
  }

  getCheatLog(): CheatLogEntry[] {
    return [...this.cheat_log]
  }

  isSpoofing(peerId: PeerId): boolean {
    return this.spoofing_peers.has(peerId)
  }

  toggleSpoof(peerId: PeerId): void {
    if (this.spoofing_peers.has(peerId)) {
      this.spoofing_peers.delete(peerId)
      this.log(peerId, 'cheat', 'spoof mode OFF')
    } else {
      this.spoofing_peers.add(peerId)
      this.log(peerId, 'cheat', 'spoof mode ON — moves will use wrong identity')
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
      this.sim.dispatch(peerId, spoofedMessage)
      this.logCheat(
        'spoof-identity',
        false,
        `${peerId} played as ${spoofedPlayer} (spoof active)`,
        peerId,
      )
      this.log(peerId, 'command', `${message.type} (spoofed as ${spoofedPlayer})`)
      this.notify()
      return
    }
    this.dispatch(peerId, message)
  }

  // ─── Cheat scenarios ───────────────────────────────────────────

  cheatSpoofIdentity(attackerId: PeerId): void {
    const spoofedPlayer = attackerId === 'player-x' ? 'O' : 'X'
    try {
      this.sim.dispatch(attackerId, {
        type: 'PLACE_MARK',
        payload: { cell: 4, player: spoofedPlayer },
      })
      this.logCheat('spoof-identity', false, `${attackerId} played as ${spoofedPlayer} — server accepted`, attackerId)
      this.log(attackerId, 'cheat', `spoofed identity → played as ${spoofedPlayer}`)
    } catch {
      this.logCheat('spoof-identity', true, 'server rejected spoofed move', attackerId)
      this.log(attackerId, 'cheat', 'spoofed identity → rejected')
    }
    this.notify()
  }

  cheatFabricateCommit(): void {
    const errorsBefore = this.sim.getErrorLog().length
    this.sim.injectWireMessage({
      kind: 'committed',
      commandId: `fabricated-${Date.now()}`,
      events: [
        { type: 'MARK_PLACED', payload: { cell: 0, player: 'X', seq: 99 } },
      ],
    })
    const errorsAfter = this.sim.getErrorLog().length
    const detected = errorsAfter > errorsBefore
    this.logCheat(
      'fabricate-commit',
      detected,
      detected
        ? 'fabricated commit was rejected'
        : 'fabricated commit was accepted by all peers',
      'wire',
    )
    this.log('system', 'cheat', 'injected fabricated committed message')
    this.notify()
  }

  cheatReplay(): void {
    const events = this.sim.getEventLog('server')
    if (events.length === 0) {
      this.logCheat('replay', false, 'no events to replay — make a move first', 'wire')
      this.log('system', 'cheat', 'replay failed — no events')
      this.notify()
      return
    }
    this.sim.injectWireMessage({
      kind: 'committed',
      commandId: `replay-${Date.now()}`,
      events: [...events],
    })
    this.logCheat(
      'replay',
      false,
      `replayed ${events.length} event(s) with new commandId`,
      'wire',
    )
    this.log('system', 'cheat', `replayed ${events.length} event(s)`)
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
    this.logCheat(
      'tamper-events',
      false,
      'MITM interceptor active — committed events will have cells shifted',
      'wire',
    )
    this.log('system', 'cheat', 'event tamper interceptor enabled')
    this.notify()
  }

  cheatClearInterceptor(): void {
    this.sim.setMessageInterceptor(null)
    this.logCheat('tamper-events', false, 'interceptor cleared', 'wire')
    this.log('system', 'cheat', 'interceptor cleared')
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
    this.logCheat(
      'flood',
      rejected > 0,
      `flood: ${accepted} accepted, ${rejected} rejected`,
      flooderId,
    )
    this.log(flooderId, 'cheat', `flood attack: ${accepted}/${accepted + rejected} accepted`)
    this.notify()
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  reset(): void {
    this.sim.destroy()
    this.sim = this.createSim()
    this.message_log = []
    this.cheat_log = []
    this.next_id = 0
    this.next_cheat_id = 0
    this.spoofing_peers.clear()
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private log(
    from: PeerId | 'system',
    kind: MessageLogEntry['kind'],
    summary: string,
  ) {
    this.message_log.push({
      id: this.next_id++,
      timestamp: Date.now(),
      from,
      kind,
      summary,
    })
  }

  private logCheat(scenario: string, detected: boolean, detail: string, peerId?: PeerId | 'wire') {
    this.cheat_log.push({
      id: this.next_cheat_id++,
      timestamp: Date.now(),
      scenario,
      detected,
      detail,
      peerId,
    })
  }

  private notify() {
    for (const fn of this.listeners) fn()
  }
}
