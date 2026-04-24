import { Assert } from '@gamezilla/lib/assert'
import type {
  Command,
  Event,
  HandleResult,
  Message,
  PeerStoreApi,
  State,
  StoreError,
  StoreModule,
  Transport,
} from './types'
import { generateId, replayEvents } from './utils'

const crash: Assert = Assert.crash()
const validation: Assert = Assert.validation()

const TOPIC = 'peer-store'

type OptimisticEvent = Event & { readonly _commandId: string }

type WireMessage =
  | { kind: 'propose'; command: Command }
  | { kind: 'accepted'; commandId: string; events: Event[] }
  | { kind: 'rejected'; commandId: string; error: StoreError }
  | { kind: 'heartbeat'; from: string }
  | { kind: 'sync-request'; from: string }
  | { kind: 'sync-response'; to: string; events: Event[] }

function computeAuthorityOrder(peers: Record<string, number>): string[] {
  return Object.entries(peers)
    .sort((a, b) => {
      const trustDiff = b[1] - a[1]
      if (trustDiff !== 0) return trustDiff
      return a[0].localeCompare(b[0])
    })
    .map(([id]) => id)
}

export class PeerStore implements PeerStoreApi {
  private readonly module: StoreModule
  private readonly peerId: string
  private readonly peers: Record<string, number>
  private readonly transport: Transport
  private readonly timeoutMs: number
  private readonly heartbeatIntervalMs: number
  private readonly heartbeatTimeoutMs: number

  private readonly authority_order: string[]
  private readonly last_seen = new Map<string, number>()
  private current_authority: string

  private readonly callbacks: {
    onTimeout?: (commandId: string) => void
    onError?: (error: StoreError) => void
    onSync?: () => void
    onCommit?: (commandId: string, events: Event[]) => void
    onReject?: (commandId: string) => void
    onAuthorityChange?: (
      newAuthority: string,
      previousAuthority: string,
    ) => void
  }

  private committed_state: State
  private committed_events: Event[] = []
  private optimistic_events: OptimisticEvent[] = []
  private seq = 0
  private is_destroyed = false
  private sync_pending = false

  private readonly subscribers = new Set<(state: State) => void>()
  private readonly pending_timeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()
  private readonly finalized_command_ids = new Set<string>()

  private transport_unsubscribe: (() => void) | null = null
  private connect_unsubscribe: (() => void) | null = null
  private heartbeat_interval: ReturnType<typeof setInterval> | null = null

  constructor(
    module: StoreModule,
    config: {
      peerId: string
      peers: Record<string, number>
      transport: Transport
      timeoutMs?: number
      heartbeatIntervalMs?: number
      heartbeatTimeoutMs?: number
    },
    callbacks?: {
      onTimeout?: (commandId: string) => void
      onError?: (error: StoreError) => void
      onSync?: () => void
      onCommit?: (commandId: string, events: Event[]) => void
      onReject?: (commandId: string) => void
      onAuthorityChange?: (
        newAuthority: string,
        previousAuthority: string,
      ) => void
    },
  ) {
    const peerIds = Object.keys(config.peers)

    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty')
    crash.ok(
      config.peerId in config.peers,
      'peers must contain peerId',
    )
    crash.ok(peerIds.length >= 2, 'peers must have at least 2 members')

    for (const [id, weight] of Object.entries(config.peers)) {
      crash.nonEmptyString(id, 'peer id must be non-empty')
      crash.ok(weight >= 0, `trust weight for peer ${id} must be >= 0`)
    }

    if (config.timeoutMs !== undefined) {
      crash.ok(config.timeoutMs > 0, 'timeoutMs must be > 0')
    }

    this.module = module
    this.peerId = config.peerId
    this.peers = { ...config.peers }
    this.transport = config.transport
    this.timeoutMs = config.timeoutMs ?? 5000
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 2000
    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 6000
    this.callbacks = callbacks ?? {}

    this.committed_state = module.initialState()
    crash.record(
      this.committed_state,
      'initialState must return a plain object',
    )

    this.authority_order = computeAuthorityOrder(this.peers)
    this.current_authority = this.authority_order[0]!

    this.transport_unsubscribe = this.transport.subscribe(
      TOPIC,
      (payload: unknown) => this.handleWireMessage(payload),
    )

    this.connect_unsubscribe = this.transport.onConnect(() => {
      this.requestSync()
    })

    this.heartbeat_interval = setInterval(() => {
      this.broadcastHeartbeat()
      this.checkAuthorityChange()
    }, this.heartbeatIntervalMs)

    this.broadcastHeartbeat()
  }

  dispatch(message: Message): void {
    crash.ok(!this.is_destroyed, 'cannot dispatch on destroyed store')
    validation.nonEmptyString(
      message.type,
      'message.type must be non-empty string',
    )

    const prev_seq = this.seq
    this.seq++
    crash.ok(
      this.seq > prev_seq,
      'seq must be strictly monotonically increasing',
    )

    const command: Command = {
      id: generateId(),
      seq: this.seq,
      peerId: this.peerId,
      message,
    }

    if (this.isAuthority()) {
      const result = this.module.handle(this.committed_state, command)
      this.assertHandleResult(result)

      if (!result.ok) {
        this.callbacks.onError?.(result.error)
        return
      }

      crash.ok(
        result.value.events.length > 0,
        'handle must produce at least one event on success',
      )

      this.handleCommit(command.id, result.value.events)
      const wire: WireMessage = {
        kind: 'accepted',
        commandId: command.id,
        events: result.value.events,
      }
      this.transport.publish(TOPIC, wire)
    } else {
      const display_state = this.computeDisplayState()
      const result = this.module.handle(display_state, command)
      this.assertHandleResult(result)

      if (!result.ok) {
        this.callbacks.onError?.(result.error)
        return
      }

      crash.ok(
        result.value.events.length > 0,
        'handle must produce at least one event on success',
      )

      for (const event of result.value.events) {
        this.optimistic_events.push({
          ...event,
          _commandId: command.id,
        })
      }

      const wire: WireMessage = { kind: 'propose', command }
      this.transport.publish(TOPIC, wire)

      if (!this.finalized_command_ids.has(command.id)) {
        const timeout = setTimeout(() => {
          this.pending_timeouts.delete(command.id)
          if (this.finalized_command_ids.has(command.id)) return

          this.optimistic_events = this.optimistic_events.filter(
            (e) => e._commandId !== command.id,
          )
          this.notifySubscribers()
          this.callbacks.onTimeout?.(command.id)
        }, this.timeoutMs)
        this.pending_timeouts.set(command.id, timeout)
      }

      this.notifySubscribers()
    }
  }

  dispatchOptimistic(event: Event): void {
    crash.ok(!this.is_destroyed, 'cannot dispatchOptimistic on destroyed store')
    crash.nonEmptyString(event.type, 'event.type must be non-empty string')

    const new_state = this.module.reduce(this.computeDisplayState(), event)
    crash.record(new_state, 'reduce must return a plain object')

    this.optimistic_events.push({
      ...event,
      _commandId: '__optimistic__',
    })
    this.notifySubscribers()
  }

  subscribe(callback: (state: State) => void): () => void {
    crash.ok(!this.is_destroyed, 'cannot subscribe on destroyed store')
    crash.ok(typeof callback === 'function', 'callback must be a function')
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  getState(): State {
    crash.ok(!this.is_destroyed, 'cannot getState on destroyed store')
    return this.computeDisplayState()
  }

  getCommittedState(): State {
    crash.ok(
      !this.is_destroyed,
      'cannot getCommittedState on destroyed store',
    )
    return this.committed_state
  }

  getCommittedEvents(): Event[] {
    crash.ok(
      !this.is_destroyed,
      'cannot getCommittedEvents on destroyed store',
    )
    return [...this.committed_events]
  }

  requestSync(): void {
    crash.ok(!this.is_destroyed, 'cannot requestSync on destroyed store')
    this.sync_pending = true
    const wire: WireMessage = { kind: 'sync-request', from: this.peerId }
    this.transport.publish(TOPIC, wire)
  }

  rehydrate(events: Event[]): void {
    crash.ok(!this.is_destroyed, 'cannot rehydrate on destroyed store')
    crash.array(events, 'events must be an array')
    for (const event of events) {
      validation.nonEmptyString(
        event.type,
        'rehydrated event must have non-empty type',
      )
    }

    this.committed_events = [...events]
    this.committed_state = replayEvents(this.module, events)
    this.optimistic_events = []

    for (const timeout of this.pending_timeouts.values()) {
      clearTimeout(timeout)
    }
    this.pending_timeouts.clear()
    this.finalized_command_ids.clear()

    this.notifySubscribers()
  }

  destroy(): void {
    if (this.is_destroyed) return
    this.is_destroyed = true

    for (const timeout of this.pending_timeouts.values()) {
      clearTimeout(timeout)
    }
    this.pending_timeouts.clear()
    this.subscribers.clear()

    if (this.heartbeat_interval !== null) {
      clearInterval(this.heartbeat_interval)
      this.heartbeat_interval = null
    }

    if (this.transport_unsubscribe) {
      this.transport_unsubscribe()
      this.transport_unsubscribe = null
    }
    if (this.connect_unsubscribe) {
      this.connect_unsubscribe()
      this.connect_unsubscribe = null
    }
  }

  getAuthorityPeerId(): string {
    crash.ok(
      !this.is_destroyed,
      'cannot getAuthorityPeerId on destroyed store',
    )
    return this.current_authority
  }

  isAuthority(): boolean {
    return this.current_authority === this.peerId
  }

  private broadcastHeartbeat(): void {
    if (this.is_destroyed) return
    const wire: WireMessage = { kind: 'heartbeat', from: this.peerId }
    this.transport.publish(TOPIC, wire)
  }

  private checkAuthorityChange(): void {
    const newAuthority = this.deriveAuthority()
    if (newAuthority !== this.current_authority) {
      const prev = this.current_authority
      this.current_authority = newAuthority
      this.callbacks.onAuthorityChange?.(newAuthority, prev)
    }
  }

  private deriveAuthority(): string {
    const alive = this.authority_order.filter(
      (id) => id === this.peerId || this.isAlive(id),
    )
    return alive[0] ?? this.peerId
  }

  private isAlive(peerId: string): boolean {
    if (peerId === this.peerId) return true
    const lastSeen = this.last_seen.get(peerId)
    if (lastSeen === undefined) return true
    return Date.now() - lastSeen < this.heartbeatTimeoutMs
  }

  private updateLastSeen(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) return
    const msg = payload as Record<string, unknown>
    const from = msg['from'] as string | undefined
    if (from && typeof from === 'string' && from !== this.peerId) {
      this.last_seen.set(from, Date.now())
    }
    const command = msg['command'] as Record<string, unknown> | undefined
    if (command && typeof command === 'object' && command !== null) {
      const cmdPeerId = command['peerId'] as string | undefined
      if (cmdPeerId && typeof cmdPeerId === 'string' && cmdPeerId !== this.peerId) {
        this.last_seen.set(cmdPeerId, Date.now())
      }
    }
  }

  private computeDisplayState(): State {
    let state = this.committed_state
    for (const event of this.optimistic_events) {
      state = this.module.reduce(state, event)
      crash.record(state, 'reduce must return a plain object')
    }
    return state
  }

  private notifySubscribers(): void {
    if (this.is_destroyed) return
    const state = this.computeDisplayState()
    for (const callback of [...this.subscribers]) {
      callback(state)
    }
  }

  private handleWireMessage(payload: unknown): void {
    if (this.is_destroyed) return
    crash.record(payload, 'wire message must be an object')
    const msg = payload as Record<string, unknown>
    crash.nonEmptyString(msg['kind'], 'wire message must have a kind')

    this.updateLastSeen(payload)
    this.checkAuthorityChange()

    const kind = msg['kind'] as string

    if (kind === 'propose') {
      this.handlePropose(msg as unknown as WireMessage & { kind: 'propose' })
    } else if (kind === 'accepted') {
      this.handleAccepted(msg as unknown as WireMessage & { kind: 'accepted' })
    } else if (kind === 'rejected') {
      this.handleRejected(msg as unknown as WireMessage & { kind: 'rejected' })
    } else if (kind === 'sync-request') {
      this.handleSyncRequest(
        msg as unknown as WireMessage & { kind: 'sync-request' },
      )
    } else if (kind === 'sync-response') {
      this.handleSyncResponse(
        msg as unknown as WireMessage & { kind: 'sync-response' },
      )
    }
  }

  private handlePropose(wire: WireMessage & { kind: 'propose' }): void {
    if (!this.isAuthority()) return
    const { command } = wire
    if (command.peerId === this.peerId) return
    if (this.finalized_command_ids.has(command.id)) return

    const result = this.module.handle(this.committed_state, command)

    if (result.ok) {
      this.handleCommit(command.id, result.value.events)
      const accepted: WireMessage = {
        kind: 'accepted',
        commandId: command.id,
        events: result.value.events,
      }
      this.transport.publish(TOPIC, accepted)
    } else {
      this.finalized_command_ids.add(command.id)
      const rejected: WireMessage = {
        kind: 'rejected',
        commandId: command.id,
        error: result.error,
      }
      this.transport.publish(TOPIC, rejected)
    }
  }

  private handleAccepted(wire: WireMessage & { kind: 'accepted' }): void {
    const { commandId, events } = wire
    this.handleCommit(commandId, events)
  }

  private handleRejected(wire: WireMessage & { kind: 'rejected' }): void {
    const { commandId } = wire
    if (this.finalized_command_ids.has(commandId)) return
    this.finalized_command_ids.add(commandId)

    this.optimistic_events = this.optimistic_events.filter(
      (e) => e._commandId !== commandId,
    )

    const timeout = this.pending_timeouts.get(commandId)
    if (timeout !== undefined) {
      clearTimeout(timeout)
      this.pending_timeouts.delete(commandId)
    }

    this.callbacks.onReject?.(commandId)
    this.notifySubscribers()
  }

  private handleCommit(commandId: string, events: Event[]): void {
    if (this.finalized_command_ids.has(commandId)) return
    this.finalized_command_ids.add(commandId)

    for (const event of events) {
      this.committed_state = this.module.reduce(this.committed_state, event)
      crash.record(
        this.committed_state,
        'reduce must return a plain object after commit',
      )
    }
    this.committed_events.push(...events)

    this.optimistic_events = this.optimistic_events.filter(
      (e) => e._commandId !== commandId,
    )

    const timeout = this.pending_timeouts.get(commandId)
    if (timeout !== undefined) {
      clearTimeout(timeout)
      this.pending_timeouts.delete(commandId)
    }

    this.callbacks.onCommit?.(commandId, events)
    this.notifySubscribers()
  }

  private handleSyncRequest(
    wire: WireMessage & { kind: 'sync-request' },
  ): void {
    if (wire.from === this.peerId) return
    if (!this.isAuthority()) return

    const response: WireMessage = {
      kind: 'sync-response',
      to: wire.from,
      events: this.getCommittedEvents(),
    }
    this.transport.publish(TOPIC, response)
  }

  private handleSyncResponse(
    wire: WireMessage & { kind: 'sync-response' },
  ): void {
    if (wire.to !== this.peerId) return
    if (!this.sync_pending) return
    this.sync_pending = false
    this.rehydrate(wire.events)
    this.callbacks.onSync?.()
  }

  private assertHandleResult(result: HandleResult): void {
    crash.defined(result, 'module.handle must return a result')
    crash.ok(
      typeof result.ok === 'boolean',
      'handle result must have ok: boolean',
    )
    if (result.ok) {
      crash.array(result.value.events, 'handle success must have events array')
    } else {
      crash.nonEmptyString(
        result.error.code,
        'handle error must have non-empty code',
      )
      crash.string(
        result.error.message,
        'handle error must have message string',
      )
    }
  }
}
