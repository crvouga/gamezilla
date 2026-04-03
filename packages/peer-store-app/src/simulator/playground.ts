import { DeterministicSimulator } from '@gamezilla/peer-store/simulator'
import { TicTacToeModule } from '@gamezilla/peer-store/__fixtures__/tic-tac-toe.module'
import type { Event, Message, State } from '@gamezilla/peer-store/types'

export const PEERS = ['player-x', 'player-o', 'worker'] as const
export type PeerId = (typeof PEERS)[number]

export type MessageLogEntry = {
  id: number
  timestamp: number
  from: PeerId
  kind: 'command' | 'vote' | 'commit' | 'timeout' | 'error'
  summary: string
}

export class PlaygroundSimulator {
  private sim: DeterministicSimulator
  private message_log: MessageLogEntry[] = []
  private next_id = 0
  private listeners = new Set<() => void>()

  constructor() {
    this.sim = this.createSim()
  }

  private createSim(): DeterministicSimulator {
    return new DeterministicSimulator(TicTacToeModule, {
      peers: [...PEERS],
      consensusTimeoutMs: 5000,
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
    this.log('worker', 'error', 'dropped message')
    this.notify()
  }

  disconnectPeer(peerId: PeerId): void {
    this.sim.disconnectPeer(peerId)
    this.log(peerId, 'error', `${peerId} disconnected`)
    this.notify()
  }

  reconnectPeer(peerId: PeerId): void {
    this.sim.reconnectPeer(peerId, { rehydrateFrom: 'worker' })
    this.log(peerId, 'commit', `${peerId} reconnected + rehydrated`)
    this.notify()
  }

  advanceTime(_ms: number): void {
    this.log('worker', 'timeout', `advance time not available in browser`)
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

  reset(): void {
    this.sim.destroy()
    this.sim = this.createSim()
    this.message_log = []
    this.next_id = 0
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private log(from: PeerId, kind: MessageLogEntry['kind'], summary: string) {
    this.message_log.push({
      id: this.next_id++,
      timestamp: Date.now(),
      from,
      kind,
      summary,
    })
  }

  private notify() {
    for (const fn of this.listeners) fn()
  }
}
