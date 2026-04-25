import { Assert } from '@gamezilla/lib/assert'
import { PeerStore } from '../peer-store'
import { InMemoryBus, InMemoryTransport, type MessageInterceptor } from '../transport'
import type { LogEntry } from '../event-log/log-entry'
import type { Event, Message, StoreError } from '../protocol/message-types'
import type { Command, State, StoreModule } from '../peer-store/peer-store-types'
import { generateId } from '../protocol/utils'

const crash: Assert = Assert.crash()

export class DeterministicSimulator {
  private readonly module: StoreModule
  private readonly topic: string
  private peer_ids: string[]
  private readonly initialMembership: Record<string, number>
  private readonly timeoutMs: number | undefined
  private readonly heartbeatIntervalMs: number | undefined
  private readonly heartbeatTimeoutMs: number | undefined
  private readonly bus: InMemoryBus
  private readonly transports = new Map<string, InMemoryTransport>()
  private readonly stores = new Map<string, PeerStore>()
  private readonly timeout_log: string[] = []
  private readonly error_log: StoreError[] = []
  private readonly authority_change_log: Array<{
    newAuthority: string
    previousAuthority: string
  }> = []
  private readonly advanceTimeFn: (ms: number) => void
  private is_destroyed = false
  private logical_time = 0

  constructor(
    module: StoreModule,
    config: {
      topic: string
      initialMembership: Record<string, number>
      timeoutMs?: number
      heartbeatIntervalMs?: number
      heartbeatTimeoutMs?: number
      advanceTime?: (ms: number) => void
    },
  ) {
    const peerIds = Object.keys(config.initialMembership)
    crash.nonEmptyString(config.topic, 'simulator requires topic')
    crash.ok(peerIds.length >= 2, 'simulator requires at least 2 peers in initialMembership')

    this.module = module
    this.topic = config.topic
    this.peer_ids = peerIds
    this.initialMembership = { ...config.initialMembership }
    this.timeoutMs = config.timeoutMs
    this.heartbeatIntervalMs = config.heartbeatIntervalMs
    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs
    this.advanceTimeFn =
      config.advanceTime ??
      (() => {
        crash.fail('advanceTime requires a config.advanceTime function')
      })

    this.bus = new InMemoryBus()
    this.buildStores(this.bus)
  }

  getStore(peerId: string): PeerStore {
    crash.ok(!this.is_destroyed, 'cannot access destroyed simulator')
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!
  }

  dispatch(peerId: string, message: Message): void {
    crash.ok(!this.is_destroyed, 'cannot dispatch on destroyed simulator')
    this.assertPeerExists(peerId)
    const store = this.stores.get(peerId)!
    store.dispatch(message)
  }

  getState(peerId: string): State {
    crash.ok(!this.is_destroyed, 'cannot getState on destroyed simulator')
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!.getState()
  }

  getCommittedState(peerId: string): State {
    crash.ok(
      !this.is_destroyed,
      'cannot getCommittedState on destroyed simulator',
    )
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!.getCommittedState()
  }

  pauseDelivery(): void {
    crash.ok(!this.is_destroyed, 'cannot pause destroyed simulator')
    this.bus.pause()
  }

  resumeDelivery(): void {
    crash.ok(!this.is_destroyed, 'cannot resume destroyed simulator')
    this.bus.resume()
  }

  dropNextMessage(): void {
    crash.ok(!this.is_destroyed, 'cannot drop message on destroyed simulator')
    this.bus.dropNextMessage()
  }

  deliverPending(): void {
    crash.ok(!this.is_destroyed, 'cannot deliver on destroyed simulator')
    this.bus.flush()
  }

  disconnectPeer(peerId: string): void {
    crash.ok(
      !this.is_destroyed,
      'cannot disconnect peer on destroyed simulator',
    )
    this.assertPeerExists(peerId)
    const transport = this.transports.get(peerId)!
    transport.disconnect()
  }

  reconnectPeer(peerId: string): void {
    crash.ok(
      !this.is_destroyed,
      'cannot reconnect peer on destroyed simulator',
    )
    this.assertPeerExists(peerId)
    const transport = this.transports.get(peerId)!
    transport.reconnect()
  }

  assertConverged(): void {
    crash.ok(
      !this.is_destroyed,
      'cannot assert convergence on destroyed simulator',
    )

    const states = new Map<string, State>()
    for (const peerId of this.peer_ids) {
      states.set(peerId, this.stores.get(peerId)!.getCommittedState())
    }

    const reference_id = this.peer_ids[0]!
    const reference_state = states.get(reference_id)!

    for (let i = 1; i < this.peer_ids.length; i++) {
      const peerId = this.peer_ids[i]!
      const peer_state = states.get(peerId)!

      const reference_json = JSON.stringify(reference_state, null, 2)
      const peer_json = JSON.stringify(peer_state, null, 2)

      if (reference_json !== peer_json) {
        const diff = buildStateDiff(
          reference_id,
          reference_state,
          peerId,
          peer_state,
        )
        crash.fail(
          `peers diverged: ${reference_id} vs ${peerId}\n${diff}`,
        )
      }
    }
  }

  advanceTime(ms: number): void {
    crash.ok(!this.is_destroyed, 'cannot advance time on destroyed simulator')
    crash.ok(ms > 0, 'ms must be positive', { ms })
    this.logical_time += ms
    this.advanceTimeFn(ms)
  }

  /** Domain committed events only (excludes `_peer/...`). */
  getEventLog(peerId: string): Event[] {
    crash.ok(
      !this.is_destroyed,
      'cannot getEventLog on destroyed simulator',
    )
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!.getCommittedEvents()
  }

  getCommittedLogEntries(peerId: string): LogEntry[] {
    crash.ok(!this.is_destroyed, 'cannot getCommittedLogEntries on destroyed simulator')
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!.getCommittedLogEntries()
  }

  getTimeoutLog(): string[] {
    return [...this.timeout_log]
  }

  getErrorLog(): StoreError[] {
    return [...this.error_log]
  }

  getAuthorityChangeLog(): Array<{
    newAuthority: string
    previousAuthority: string
  }> {
    return [...this.authority_change_log]
  }

  injectWireMessage(wireMessage: unknown): void {
    crash.ok(!this.is_destroyed, 'cannot inject on destroyed simulator')
    this.bus.publish(this.topic, wireMessage)
  }

  setMessageInterceptor(fn: MessageInterceptor | null): void {
    crash.ok(!this.is_destroyed, 'cannot set interceptor on destroyed simulator')
    this.bus.setInterceptor(fn)
  }

  forgeCommand(
    peerId: string,
    message: Message,
    overrides?: { id?: string; seq?: number; fakePeerId?: string },
  ): Command {
    crash.ok(!this.is_destroyed, 'cannot forge on destroyed simulator')
    return {
      id: overrides?.id ?? generateId(),
      seq: overrides?.seq ?? 0,
      peerId: overrides?.fakePeerId ?? peerId,
      message,
    }
  }

  getTransport(peerId: string): InMemoryTransport {
    crash.ok(!this.is_destroyed, 'cannot getTransport on destroyed simulator')
    this.assertPeerExists(peerId)
    return this.transports.get(peerId)!
  }

  getTopic(): string {
    return this.topic
  }

  getLatestSeq(peerId: string): number {
    crash.ok(!this.is_destroyed, 'cannot getLatestSeq on destroyed simulator')
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!.getLatestSeq()
  }

  /**
   * Add a new peer that bootstraps with `join` (syncs from current authority).
   * Caller should `deliverPending` / `resumeDelivery` so sync completes.
   */
  joinPeer(peerId: string, trust: number): void {
    crash.ok(!this.is_destroyed, 'cannot joinPeer on destroyed simulator')
    crash.nonEmptyString(peerId, 'peerId must be non-empty')
    crash.ok(!this.stores.has(peerId), `peer already exists: ${peerId}`)
    crash.ok(trust >= 0, 'trust must be >= 0')

    const transport = new InMemoryTransport(this.bus, peerId)
    this.transports.set(peerId, transport)

    const store = new PeerStore(
      this.module,
      {
        topic: this.topic,
        peerId,
        bootstrap: { kind: 'join' },
        transport,
        ...(this.timeoutMs !== undefined ? { timeoutMs: this.timeoutMs } : {}),
        ...(this.heartbeatIntervalMs !== undefined
          ? { heartbeatIntervalMs: this.heartbeatIntervalMs }
          : {}),
        ...(this.heartbeatTimeoutMs !== undefined
          ? { heartbeatTimeoutMs: this.heartbeatTimeoutMs }
          : {}),
      },
      {
        onTimeout: (commandId) => {
          this.timeout_log.push(commandId)
        },
        onError: (error) => {
          this.error_log.push(error)
        },
        onAuthorityChange: (newAuthority, previousAuthority) => {
          this.authority_change_log.push({ newAuthority, previousAuthority })
        },
      },
    )
    this.stores.set(peerId, store)
    this.peer_ids = [...this.peer_ids, peerId]

    store.proposeJoin(peerId, trust)
    this.bus.flush()
  }

  leavePeer(peerId: string): void {
    crash.ok(!this.is_destroyed, 'cannot leavePeer on destroyed simulator')
    this.assertPeerExists(peerId)
    const store = this.stores.get(peerId)!
    store.proposeLeave(peerId)
    this.bus.flush()
    store.destroy()
    this.transports.get(peerId)?.destroy()
    this.stores.delete(peerId)
    this.transports.delete(peerId)
    this.peer_ids = this.peer_ids.filter((id) => id !== peerId)
  }

  reset(): void {
    crash.ok(!this.is_destroyed, 'cannot reset destroyed simulator')

    for (const store of this.stores.values()) {
      store.destroy()
    }
    for (const transport of this.transports.values()) {
      transport.destroy()
    }
    this.stores.clear()
    this.transports.clear()
    this.bus.destroy()

    const new_bus = new InMemoryBus()
    Object.assign(this, { bus: new_bus })
    this.peer_ids = Object.keys(this.initialMembership)
    this.buildStores(new_bus)

    this.timeout_log.length = 0
    this.error_log.length = 0
    this.authority_change_log.length = 0
    this.logical_time = 0
  }

  destroy(): void {
    if (this.is_destroyed) return
    this.is_destroyed = true

    for (const store of this.stores.values()) {
      store.destroy()
    }
    for (const transport of this.transports.values()) {
      transport.destroy()
    }
    this.bus.destroy()
  }

  private buildStores(bus: InMemoryBus): void {
    for (const peerId of this.peer_ids) {
      const transport = new InMemoryTransport(bus, peerId)
      this.transports.set(peerId, transport)

      const store = new PeerStore(
        this.module,
        {
          topic: this.topic,
          peerId,
          bootstrap: {
            kind: 'genesis',
            initialMembership: this.initialMembership,
          },
          transport,
          ...(this.timeoutMs !== undefined
            ? { timeoutMs: this.timeoutMs }
            : {}),
          ...(this.heartbeatIntervalMs !== undefined
            ? { heartbeatIntervalMs: this.heartbeatIntervalMs }
            : {}),
          ...(this.heartbeatTimeoutMs !== undefined
            ? { heartbeatTimeoutMs: this.heartbeatTimeoutMs }
            : {}),
        },
        {
          onTimeout: (commandId) => {
            this.timeout_log.push(commandId)
          },
          onError: (error) => {
            this.error_log.push(error)
          },
          onAuthorityChange: (newAuthority, previousAuthority) => {
            this.authority_change_log.push({ newAuthority, previousAuthority })
          },
        },
      )
      this.stores.set(peerId, store)
    }
  }

  private assertPeerExists(peerId: string): void {
    crash.ok(this.peer_ids.includes(peerId), `unknown peer: ${peerId}`, {
      known_peers: this.peer_ids,
    })
  }
}

function buildStateDiff(
  id_a: string,
  state_a: State,
  id_b: string,
  state_b: State,
): string {
  const lines: string[] = []
  const all_keys = new Set([
    ...Object.keys(state_a),
    ...Object.keys(state_b),
  ])

  for (const key of all_keys) {
    const val_a = JSON.stringify(state_a[key])
    const val_b = JSON.stringify(state_b[key])
    if (val_a !== val_b) {
      lines.push(`  key "${key}":`)
      lines.push(`    ${id_a}: ${val_a ?? 'undefined'}`)
      lines.push(`    ${id_b}: ${val_b ?? 'undefined'}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : '  (states are identical)'
}
