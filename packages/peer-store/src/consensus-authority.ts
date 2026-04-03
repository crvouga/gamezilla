import { Assert } from '@gamezilla/shared/assert'
import { ConsensusProtocol, type Vote } from './consensus-protocol'
import type { Authority, AuthoritySink, Command, Event } from './types'

const crash: Assert = Assert.crash()

type ConsensusWireMessage =
  | { kind: 'command'; command: Command; events: Event[] }
  | { kind: 'vote'; vote: Vote }

/**
 * P2P consensus authority: every peer validates commands and votes ACK/REJECT.
 * Commands commit when ACK votes reach quorum; reject when REJECT votes reach quorum.
 *
 * Supports weighted voting and configurable quorum thresholds.
 * Buffers out-of-order votes that arrive before their command.
 */
export class ConsensusAuthority implements Authority {
  private readonly peerId: string
  private readonly consensus: ConsensusProtocol
  private sink: AuthoritySink | null = null
  private readonly pending_events = new Map<string, Event[]>()
  private readonly resolved = new Set<string>()
  private readonly buffered_votes = new Map<string, Vote[]>()

  constructor(config: {
    peerId: string
    peers: string[]
    quorum?: number
    weights?: Record<string, number>
  }) {
    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty')
    crash.ok(config.peers.includes(config.peerId), 'peers must contain peerId')

    this.peerId = config.peerId
    this.consensus = new ConsensusProtocol(
      config.peers,
      config.quorum,
      config.weights,
    )
  }

  bind(sink: AuthoritySink): void {
    crash.ok(this.sink === null, 'authority already bound')
    this.sink = sink
  }

  onLocalCommand(command: Command, proposedEvents: Event[]): void {
    const sink = this.requireSink()
    if (this.resolved.has(command.id)) return

    this.pending_events.set(command.id, proposedEvents)

    this.processVote({
      commandId: command.id,
      from: this.peerId,
      vote: 'ACK',
    })

    if (!this.resolved.has(command.id)) {
      sink.broadcast({ kind: 'command', command, events: proposedEvents })
      sink.broadcast({
        kind: 'vote',
        vote: { commandId: command.id, from: this.peerId, vote: 'ACK' },
      })
    }
  }

  onMessage(message: unknown): void {
    if (this.sink === null) return
    crash.record(message, 'authority message must be an object')

    const msg = message as Record<string, unknown>
    const kind = msg['kind'] as string

    if (kind === 'command') {
      this.handleRemoteCommand(
        msg as unknown as ConsensusWireMessage & { kind: 'command' },
      )
    } else if (kind === 'vote') {
      this.handleRemoteVote(
        msg as unknown as ConsensusWireMessage & { kind: 'vote' },
      )
    }
  }

  reset(): void {
    this.consensus.resetAll()
    this.resolved.clear()
    this.pending_events.clear()
    this.buffered_votes.clear()
  }

  destroy(): void {
    this.pending_events.clear()
    this.resolved.clear()
    this.buffered_votes.clear()
    this.sink = null
  }

  private handleRemoteCommand(
    wire: ConsensusWireMessage & { kind: 'command' },
  ): void {
    const { command, events } = wire
    const sink = this.requireSink()

    if (command.peerId === this.peerId) return
    if (this.resolved.has(command.id)) return

    this.pending_events.set(command.id, events)

    const result = sink.getModule().handle(sink.getCommittedState(), command)
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
    this.flushBufferedVotes(command.id)

    if (!this.resolved.has(command.id)) {
      sink.broadcast({ kind: 'vote', vote })
    }
  }

  private handleRemoteVote(
    wire: ConsensusWireMessage & { kind: 'vote' },
  ): void {
    const { vote } = wire
    if (vote.from === this.peerId) return
    if (this.resolved.has(vote.commandId)) return
    if (this.consensus.isResolved(vote.commandId)) return

    if (!this.pending_events.has(vote.commandId)) {
      if (!this.buffered_votes.has(vote.commandId)) {
        this.buffered_votes.set(vote.commandId, [])
      }
      this.buffered_votes.get(vote.commandId)!.push(vote)
      return
    }

    this.processVote(vote)
  }

  private flushBufferedVotes(commandId: string): void {
    const votes = this.buffered_votes.get(commandId)
    if (!votes) return
    this.buffered_votes.delete(commandId)
    for (const vote of votes) {
      if (this.resolved.has(commandId)) break
      this.processVote(vote)
    }
  }

  private processVote(vote: Vote): void {
    if (this.resolved.has(vote.commandId)) return
    if (this.consensus.isResolved(vote.commandId)) return

    const result = this.consensus.record(vote)
    const sink = this.requireSink()

    if (result.status === 'COMMITTED') {
      this.resolved.add(vote.commandId)

      const events = this.pending_events.get(vote.commandId)
      crash.defined(
        events,
        `no events for committed command: ${vote.commandId}`,
      )
      sink.commit(vote.commandId, events!)
      this.pending_events.delete(vote.commandId)

      const bad_actors = this.consensus.getBadActors(vote.commandId)
      for (const id of bad_actors) {
        sink.reportBadActor(id, vote.commandId)
      }
    } else if (result.status === 'REJECTED') {
      this.resolved.add(vote.commandId)
      sink.reject(vote.commandId)
      this.pending_events.delete(vote.commandId)

      const bad_actors = this.consensus.getBadActors(vote.commandId)
      for (const id of bad_actors) {
        sink.reportBadActor(id, vote.commandId)
      }
    }
  }

  private assertHandleResult(result: unknown): void {
    crash.defined(result, 'module.handle must return a result')
    const r = result as Record<string, unknown>
    crash.ok(typeof r['ok'] === 'boolean', 'handle result must have ok: boolean')
  }

  private requireSink(): AuthoritySink {
    crash.ok(this.sink !== null, 'authority not bound to store')
    return this.sink!
  }
}
