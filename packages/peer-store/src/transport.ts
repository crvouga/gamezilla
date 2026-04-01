import { Assert } from '@gamezilla/shared/assert'
import type { Transport } from './types'

const crash: Assert = Assert.crash()

type Subscriber = (payload: unknown) => void
type QueuedMessage = { topic: string; payload: unknown }

export class InMemoryBus {
  private readonly subscribers = new Map<string, Set<Subscriber>>()
  private is_destroyed = false
  private is_paused = false
  private readonly queue: QueuedMessage[] = []
  private readonly QUEUE_BOUND = 10_000

  publish(topic: string, payload: unknown): void {
    crash.ok(!this.is_destroyed, 'cannot publish on destroyed bus')
    crash.nonEmptyString(topic, 'topic must be non-empty string')

    if (this.is_paused) {
      crash.ok(
        this.queue.length < this.QUEUE_BOUND,
        'message queue exceeded bound',
        { queue_length: this.queue.length, bound: this.QUEUE_BOUND },
      )
      this.queue.push({ topic, payload })
      return
    }

    this.deliverToSubscribers(topic, payload)
  }

  subscribe(topic: string, handler: Subscriber): () => void {
    crash.ok(!this.is_destroyed, 'cannot subscribe on destroyed bus')
    crash.nonEmptyString(topic, 'topic must be non-empty string')
    crash.ok(typeof handler === 'function', 'handler must be a function')

    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set())
    }
    const handlers = this.subscribers.get(topic)!
    handlers.add(handler)

    return () => {
      handlers.delete(handler)
    }
  }

  pause(): void {
    crash.ok(!this.is_destroyed, 'cannot pause destroyed bus')
    crash.ok(!this.is_paused, 'bus is already paused')
    this.is_paused = true
  }

  resume(): void {
    crash.ok(!this.is_destroyed, 'cannot resume destroyed bus')
    crash.ok(this.is_paused, 'bus is not paused')
    this.is_paused = false
    this.flush()
  }

  flush(): void {
    crash.ok(!this.is_destroyed, 'cannot flush destroyed bus')
    const snapshot = this.queue.splice(0, this.queue.length)
    for (const msg of snapshot) {
      if (this.is_paused) {
        this.queue.push(msg)
        break
      }
      this.deliverToSubscribers(msg.topic, msg.payload)
    }
  }

  dropNextMessage(): void {
    crash.ok(!this.is_destroyed, 'cannot drop message on destroyed bus')
    crash.ok(this.queue.length > 0, 'no messages to drop')
    this.queue.shift()
  }

  get pendingCount(): number {
    return this.queue.length
  }

  get paused(): boolean {
    return this.is_paused
  }

  destroy(): void {
    if (this.is_destroyed) return
    this.is_destroyed = true
    this.subscribers.clear()
    this.queue.length = 0
  }

  private deliverToSubscribers(topic: string, payload: unknown): void {
    const handlers = this.subscribers.get(topic)
    if (!handlers) return
    for (const handler of [...handlers]) {
      handler(payload)
    }
  }
}

export class InMemoryTransport implements Transport {
  private readonly bus: InMemoryBus
  readonly peerId: string
  private is_connected = true
  private is_destroyed = false
  private readonly unsubscribers: Array<() => void> = []

  constructor(bus: InMemoryBus, peerId: string) {
    crash.nonEmptyString(peerId, 'peerId must be non-empty string')
    this.bus = bus
    this.peerId = peerId
  }

  get connected(): boolean {
    return this.is_connected
  }

  disconnect(): void {
    crash.ok(this.is_connected, 'peer is already disconnected')
    this.is_connected = false
  }

  reconnect(): void {
    crash.ok(!this.is_connected, 'peer is not disconnected')
    this.is_connected = true
  }

  publish(topic: string, payload: unknown): void {
    crash.ok(!this.is_destroyed, 'cannot publish on destroyed transport')
    crash.nonEmptyString(topic, 'topic must be non-empty string')
    if (!this.is_connected) return
    this.bus.publish(topic, payload)
  }

  subscribe(topic: string, handler: (payload: unknown) => void): () => void {
    crash.ok(!this.is_destroyed, 'cannot subscribe on destroyed transport')
    crash.nonEmptyString(topic, 'topic must be non-empty string')
    crash.ok(typeof handler === 'function', 'handler must be a function')

    const wrappedHandler = (payload: unknown) => {
      if (!this.is_connected) return
      handler(payload)
    }

    const unsubscribe = this.bus.subscribe(topic, wrappedHandler)
    this.unsubscribers.push(unsubscribe)
    return unsubscribe
  }

  destroy(): void {
    if (this.is_destroyed) return
    this.is_destroyed = true
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers.length = 0
  }
}
