import { Assert } from '@gamezilla/lib/assert'
import { InMemoryBus } from './in-memory-bus'
import type { Transport, TransportMessageContext } from './transport-types'

const crash: Assert = Assert.crash()

export class InMemoryTransport implements Transport {
  private readonly bus: InMemoryBus
  readonly peerId: string
  private is_connected = true
  private is_destroyed = false
  private readonly unsubscribers: Array<() => void> = []
  private readonly connect_handlers = new Set<() => void>()
  private readonly outgoing_queue: Array<{ topic: string; payload: unknown }> =
    []
  private readonly incoming_queue: Array<{
    handler: (payload: unknown, context?: TransportMessageContext) => void
    payload: unknown
    context?: TransportMessageContext
  }> = []

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
    const outgoing = this.outgoing_queue.splice(0, this.outgoing_queue.length)
    for (const msg of outgoing) {
      this.bus.publish(msg.topic, msg.payload)
    }
    const incoming = this.incoming_queue.splice(0, this.incoming_queue.length)
    for (const msg of incoming) {
      msg.handler(msg.payload, msg.context)
    }
    for (const handler of [...this.connect_handlers]) {
      handler()
    }
  }

  onConnect(handler: () => void): () => void {
    crash.ok(!this.is_destroyed, 'cannot onConnect on destroyed transport')
    crash.ok(typeof handler === 'function', 'handler must be a function')
    this.connect_handlers.add(handler)
    return () => {
      this.connect_handlers.delete(handler)
    }
  }

  publish(topic: string, payload: unknown): void {
    crash.ok(!this.is_destroyed, 'cannot publish on destroyed transport')
    crash.nonEmptyString(topic, 'topic must be non-empty string')
    if (!this.is_connected) {
      this.outgoing_queue.push({ topic, payload })
      return
    }
    this.bus.publish(topic, payload)
  }

  subscribe(
    topic: string,
    handler: (payload: unknown, context?: TransportMessageContext) => void,
  ): () => void {
    crash.ok(!this.is_destroyed, 'cannot subscribe on destroyed transport')
    crash.nonEmptyString(topic, 'topic must be non-empty string')
    crash.ok(typeof handler === 'function', 'handler must be a function')

    const wrappedHandler = (
      payload: unknown,
      context?: TransportMessageContext,
    ) => {
      if (!this.is_connected) {
        if (context === undefined) {
          this.incoming_queue.push({ handler, payload })
        } else {
          this.incoming_queue.push({ handler, payload, context })
        }
        return
      }
      handler(payload, context)
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
    this.connect_handlers.clear()
  }
}
