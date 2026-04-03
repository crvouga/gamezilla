import { Assert } from '@gamezilla/shared/assert'
import type {
  Authority,
  AuthoritySink,
  Command,
  Event,
  StoreError,
} from './types'

const crash: Assert = Assert.crash()

type ServerWireMessage =
  | { kind: 'submit'; command: Command }
  | { kind: 'committed'; commandId: string; events: Event[] }
  | { kind: 'rejected'; commandId: string; error: StoreError }

/**
 * Server-authoritative commit model.
 *
 * One designated peer (the server) validates every command and decides commit
 * or reject.  Clients send commands to the server and apply the server's
 * decisions.  Ideal for competitive / money-on-the-line games where a single
 * trusted source of truth eliminates state-divergence risk.
 *
 * The serverId can be a dedicated backend process OR a client that other
 * peers elected as referee — the authority doesn't care how the server was
 * chosen, only that every peer agrees on the same serverId.
 */
export class ServerAuthority implements Authority {
  private readonly peerId: string
  private readonly isServer: boolean
  private sink: AuthoritySink | null = null
  private readonly resolved = new Set<string>()

  constructor(config: { peerId: string; serverId: string }) {
    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty')
    crash.nonEmptyString(config.serverId, 'config.serverId must be non-empty')
    this.peerId = config.peerId
    this.isServer = config.peerId === config.serverId
  }

  bind(sink: AuthoritySink): void {
    crash.ok(this.sink === null, 'authority already bound')
    this.sink = sink
  }

  onLocalCommand(command: Command, _proposedEvents: Event[]): void {
    const sink = this.requireSink()
    if (this.resolved.has(command.id)) return

    if (this.isServer) {
      const result = sink.getModule().handle(sink.getCommittedState(), command)
      if (result.ok) {
        const events = result.value.events
        this.resolved.add(command.id)
        sink.commit(command.id, events)
        const wire: ServerWireMessage = {
          kind: 'committed',
          commandId: command.id,
          events,
        }
        sink.broadcast(wire)
      } else {
        this.resolved.add(command.id)
        sink.reject(command.id)
      }
    } else {
      const wire: ServerWireMessage = { kind: 'submit', command }
      sink.broadcast(wire)
    }
  }

  onMessage(message: unknown): void {
    if (this.sink === null) return
    crash.record(message, 'authority message must be an object')

    const msg = message as Record<string, unknown>
    const kind = msg['kind'] as string

    if (kind === 'submit') {
      this.handleSubmit(
        msg as unknown as ServerWireMessage & { kind: 'submit' },
      )
    } else if (kind === 'committed') {
      this.handleCommitted(
        msg as unknown as ServerWireMessage & { kind: 'committed' },
      )
    } else if (kind === 'rejected') {
      this.handleRejected(
        msg as unknown as ServerWireMessage & { kind: 'rejected' },
      )
    }
  }

  reset(): void {
    this.resolved.clear()
  }

  destroy(): void {
    this.resolved.clear()
    this.sink = null
  }

  private handleSubmit(
    wire: ServerWireMessage & { kind: 'submit' },
  ): void {
    if (!this.isServer) return
    const { command } = wire
    if (command.peerId === this.peerId) return
    if (this.resolved.has(command.id)) return

    const sink = this.requireSink()
    const result = sink.getModule().handle(sink.getCommittedState(), command)

    if (result.ok) {
      const events = result.value.events
      this.resolved.add(command.id)
      sink.commit(command.id, events)
      const committed: ServerWireMessage = {
        kind: 'committed',
        commandId: command.id,
        events,
      }
      sink.broadcast(committed)
    } else {
      this.resolved.add(command.id)
      const rejected: ServerWireMessage = {
        kind: 'rejected',
        commandId: command.id,
        error: result.error,
      }
      sink.broadcast(rejected)
    }
  }

  private handleCommitted(
    wire: ServerWireMessage & { kind: 'committed' },
  ): void {
    const { commandId, events } = wire
    if (this.resolved.has(commandId)) return
    this.resolved.add(commandId)
    this.requireSink().commit(commandId, events)
  }

  private handleRejected(
    wire: ServerWireMessage & { kind: 'rejected' },
  ): void {
    const { commandId } = wire
    if (this.resolved.has(commandId)) return
    this.resolved.add(commandId)
    this.requireSink().reject(commandId)
  }

  private requireSink(): AuthoritySink {
    crash.ok(this.sink !== null, 'authority not bound to store')
    return this.sink!
  }
}
