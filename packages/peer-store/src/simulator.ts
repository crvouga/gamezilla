import { Assert } from '@gamezilla/shared/assert'
import { ConsensusAuthority } from './consensus-authority'
import { PeerStore } from './peer-store'
import { designatedSyncPeer } from './sync-policy'
import { InMemoryBus, InMemoryTransport, type MessageInterceptor } from './transport'
import type { Authority, Command, Event, Message, State, StoreModule, SyncPolicy } from './types'
import { generateId } from './utils'

const crash: Assert = Assert.crash()

const TOPIC = 'peer-store'

export type AuthorityFactory = (config: {
  peerId: string
  peers: string[]
}) => Authority

export class DeterministicSimulator {
  private readonly module: StoreModule
  private readonly peer_ids: string[]
  private readonly syncPolicy: SyncPolicy | undefined
  private readonly createAuthority: AuthorityFactory
  private readonly consensusTimeoutMs: number | undefined
  private readonly bus: InMemoryBus
  private readonly transports = new Map<string, InMemoryTransport>()
  private readonly stores = new Map<string, PeerStore>()
  private readonly bad_actor_log: Array<{
    peerId: string
    commandId: string
  }> = []
  private readonly timeout_log: string[] = []
  private readonly error_log: Array<{ code: string; message: string }> = []
  private readonly advanceTimeFn: (ms: number) => void
  private is_destroyed = false
  private logical_time = 0

  constructor(
    module: StoreModule,
    config: {
      peers: string[]
      createAuthority?: AuthorityFactory
      consensusTimeoutMs?: number
      advanceTime?: (ms: number) => void
      syncPolicy?: SyncPolicy | string
    },
  ) {
    crash.ok(config.peers.length >= 2, 'simulator requires at least 2 peers')

    this.module = module
    this.peer_ids = [...config.peers]
    this.advanceTimeFn =
      config.advanceTime ??
      (() => {
        crash.fail('advanceTime requires a config.advanceTime function')
      })

    this.createAuthority =
      config.createAuthority ??
      (({ peerId, peers }) => new ConsensusAuthority({ peerId, peers }))

    this.consensusTimeoutMs = config.consensusTimeoutMs

    this.syncPolicy =
      typeof config.syncPolicy === 'string'
        ? designatedSyncPeer(config.syncPolicy)
        : config.syncPolicy

    this.bus = new InMemoryBus()
    this.buildStores(this.bus, config.peers)
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

  getEventLog(peerId: string): Event[] {
    crash.ok(
      !this.is_destroyed,
      'cannot getEventLog on destroyed simulator',
    )
    this.assertPeerExists(peerId)
    return this.stores.get(peerId)!.getCommittedEvents()
  }

  getBadActorLog(): Array<{ peerId: string; commandId: string }> {
    return [...this.bad_actor_log]
  }

  getTimeoutLog(): string[] {
    return [...this.timeout_log]
  }

  getErrorLog(): Array<{ code: string; message: string }> {
    return [...this.error_log]
  }

  injectWireMessage(wireMessage: unknown): void {
    crash.ok(!this.is_destroyed, 'cannot inject on destroyed simulator')
    this.bus.publish(TOPIC, wireMessage)
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
    this.buildStores(new_bus, this.peer_ids)

    this.bad_actor_log.length = 0
    this.timeout_log.length = 0
    this.error_log.length = 0
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

  private buildStores(bus: InMemoryBus, peers: string[]): void {
    for (const peerId of peers) {
      const transport = new InMemoryTransport(bus, peerId)
      this.transports.set(peerId, transport)

      const authority = this.createAuthority({ peerId, peers })

      const store = new PeerStore(
        this.module,
        {
          peerId,
          peers,
          transport,
          authority,
          ...(this.consensusTimeoutMs !== undefined
            ? { consensusTimeoutMs: this.consensusTimeoutMs }
            : {}),
          ...(this.syncPolicy !== undefined
            ? { syncPolicy: this.syncPolicy }
            : {}),
        },
        {
          onBadActor: (badPeerId, commandId) => {
            this.bad_actor_log.push({ peerId: badPeerId, commandId })
          },
          onTimeout: (commandId) => {
            this.timeout_log.push(commandId)
          },
          onError: (error) => {
            this.error_log.push(error)
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
