import { Assert } from '@gamezilla/shared/assert'
import { ConsensusProtocol } from './consensus-protocol'
import type {
  Command,
  Event,
  HandleResult,
  Message,
  PeerStoreApi,
  State,
  StoreModule,
  SyncPolicy,
  Transport,
  Vote,
} from './types'
import { generateId, replayEvents } from './utils'

const crash: Assert = Assert.crash()
const validation: Assert = Assert.validation()

const TOPIC = 'peer-store'

type OptimisticEvent = Event & { readonly _commandId: string }

type WireMessage =
  | { kind: 'command'; command: Command; events: Event[] }
  | { kind: 'vote'; vote: Vote }
  | { kind: 'sync-request'; from: string }
  | { kind: 'sync-response'; to: string; events: Event[] }

export class PeerStore implements PeerStoreApi {
  private readonly module: StoreModule
  private readonly peerId: string
  private readonly peers: string[]
  private readonly transport: Transport
  private readonly consensus: ConsensusProtocol
  private readonly consensusTimeoutMs: number
  private readonly syncPolicy: SyncPolicy | null

  private readonly callbacks: {
    onBadActor?: (peerId: string, commandId: string) => void
    onTimeout?: (commandId: string) => void
    onError?: (error: { code: string; message: string }) => void
    onSync?: () => void
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
  private readonly pending_command_events = new Map<string, Event[]>()
  private readonly resolved_command_ids = new Set<string>()

  private transport_unsubscribe: (() => void) | null = null
  private connect_unsubscribe: (() => void) | null = null

  constructor(
    module: StoreModule,
    config: {
      peerId: string
      peers: string[]
      transport: Transport
      quorum?: number
      consensusTimeoutMs?: number
      weights?: Record<string, number>
      syncPolicy?: SyncPolicy
    },
    callbacks?: {
      onBadActor?: (peerId: string, commandId: string) => void
      onTimeout?: (commandId: string) => void
      onError?: (error: { code: string; message: string }) => void
      onSync?: () => void
    },
  ) {
    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty')
    crash.ok(config.peers.includes(config.peerId), 'peers must contain peerId')
    crash.ok(config.peers.length >= 2, 'peers must have at least 2 members')

    const unique = new Set(config.peers)
    crash.ok(unique.size === config.peers.length, 'duplicate peer ids')

    if (config.consensusTimeoutMs !== undefined) {
      crash.ok(config.consensusTimeoutMs > 0, 'consensusTimeoutMs must be > 0')
    }

    this.module = module
    this.peerId = config.peerId
    this.peers = [...config.peers]
    this.transport = config.transport
    this.consensusTimeoutMs = config.consensusTimeoutMs ?? 5000
    this.syncPolicy = config.syncPolicy ?? null
    this.callbacks = callbacks ?? {}

    this.consensus = new ConsensusProtocol(
      config.peers,
      config.quorum,
      config.weights,
    )
    this.committed_state = module.initialState()
    crash.record(
      this.committed_state,
      'initialState must return a plain object',
    )

    this.transport_unsubscribe = this.transport.subscribe(
      TOPIC,
      (payload: unknown) => this.handleWireMessage(payload),
    )

    if (this.syncPolicy) {
      this.connect_unsubscribe = this.transport.onConnect(() => {
        this.requestSync()
      })
    }
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

    const events = result.value.events
    this.pending_command_events.set(command.id, events)

    for (const event of events) {
      this.optimistic_events.push({
        ...event,
        _commandId: command.id,
      })
    }

    this.processVote({
      commandId: command.id,
      from: this.peerId,
      vote: 'ACK',
    })

    this.notifySubscribers()

    const wire: WireMessage = { kind: 'command', command, events }
    this.transport.publish(TOPIC, wire)

    const vote_wire: WireMessage = {
      kind: 'vote',
      vote: { commandId: command.id, from: this.peerId, vote: 'ACK' },
    }
    this.transport.publish(TOPIC, vote_wire)

    if (!this.resolved_command_ids.has(command.id)) {
      const timeout = setTimeout(() => {
        this.pending_timeouts.delete(command.id)
        if (this.resolved_command_ids.has(command.id)) return
        this.resolved_command_ids.add(command.id)

        this.optimistic_events = this.optimistic_events.filter(
          (e) => e._commandId !== command.id,
        )
        this.pending_command_events.delete(command.id)
        this.notifySubscribers()
        this.callbacks.onTimeout?.(command.id)
      }, this.consensusTimeoutMs)
      this.pending_timeouts.set(command.id, timeout)
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
    this.pending_command_events.clear()

    for (const commandId of this.resolved_command_ids) {
      this.consensus.reset(commandId)
    }
    this.resolved_command_ids.clear()

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

    if (this.transport_unsubscribe) {
      this.transport_unsubscribe()
      this.transport_unsubscribe = null
    }
    if (this.connect_unsubscribe) {
      this.connect_unsubscribe()
      this.connect_unsubscribe = null
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

    if (msg['kind'] === 'command') {
      this.handleIncomingCommand(msg as unknown as WireMessage & { kind: 'command' })
    } else if (msg['kind'] === 'vote') {
      this.handleIncomingVote(msg as unknown as WireMessage & { kind: 'vote' })
    } else if (msg['kind'] === 'sync-request') {
      this.handleSyncRequest(msg as unknown as WireMessage & { kind: 'sync-request' })
    } else if (msg['kind'] === 'sync-response') {
      this.handleSyncResponse(msg as unknown as WireMessage & { kind: 'sync-response' })
    }
  }

  private handleIncomingCommand(
    wire: WireMessage & { kind: 'command' },
  ): void {
    const { command, events } = wire

    if (command.peerId === this.peerId) return
    if (this.resolved_command_ids.has(command.id)) return

    this.pending_command_events.set(command.id, events)

    const result = this.module.handle(this.committed_state, command)
    this.assertHandleResult(result)

    const vote: Vote = result.ok
      ? { commandId: command.id, from: this.peerId, vote: 'ACK' }
      : {
          commandId: command.id,
          from: this.peerId,
          vote: 'REJECT',
          reason: result.error.message,
        }

    this.processVote(vote)

    if (!this.resolved_command_ids.has(command.id)) {
      const vote_wire: WireMessage = { kind: 'vote', vote }
      this.transport.publish(TOPIC, vote_wire)
    }
  }

  private handleIncomingVote(wire: WireMessage & { kind: 'vote' }): void {
    const { vote } = wire
    if (vote.from === this.peerId) return
    if (this.resolved_command_ids.has(vote.commandId)) return
    if (this.consensus.isResolved(vote.commandId)) return

    this.processVote(vote)
  }

  private processVote(vote: Vote): void {
    if (this.resolved_command_ids.has(vote.commandId)) return
    if (this.consensus.isResolved(vote.commandId)) return

    const result = this.consensus.record(vote)

    if (result.status === 'COMMITTED') {
      this.applyCommit(vote.commandId)
    } else if (result.status === 'REJECTED') {
      this.applyReject(vote.commandId)
    }
  }

  private applyCommit(commandId: string): void {
    if (this.resolved_command_ids.has(commandId)) return
    this.resolved_command_ids.add(commandId)

    const events = this.pending_command_events.get(commandId)
    crash.defined(
      events,
      `no events found for committed command: ${commandId}`,
    )

    for (const event of events!) {
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

    this.pending_command_events.delete(commandId)

    const bad_actors = this.consensus.getBadActors(commandId)
    for (const bad_actor of bad_actors) {
      this.callbacks.onBadActor?.(bad_actor, commandId)
    }

    this.notifySubscribers()
  }

  private applyReject(commandId: string): void {
    if (this.resolved_command_ids.has(commandId)) return
    this.resolved_command_ids.add(commandId)

    this.optimistic_events = this.optimistic_events.filter(
      (e) => e._commandId !== commandId,
    )

    const timeout = this.pending_timeouts.get(commandId)
    if (timeout !== undefined) {
      clearTimeout(timeout)
      this.pending_timeouts.delete(commandId)
    }

    this.pending_command_events.delete(commandId)

    const bad_actors = this.consensus.getBadActors(commandId)
    for (const bad_actor of bad_actors) {
      this.callbacks.onBadActor?.(bad_actor, commandId)
    }

    this.notifySubscribers()
  }

  private handleSyncRequest(
    wire: WireMessage & { kind: 'sync-request' },
  ): void {
    if (wire.from === this.peerId) return
    if (!this.syncPolicy) return
    if (!this.syncPolicy.isSyncSource(this.peerId, this.peers)) return

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
    crash.ok(typeof result.ok === 'boolean', 'handle result must have ok: boolean')
    if (result.ok) {
      crash.array(result.value.events, 'handle success must have events array')
    } else {
      crash.nonEmptyString(
        result.error.code,
        'handle error must have non-empty code',
      )
      crash.string(result.error.message, 'handle error must have message string')
    }
  }
}
