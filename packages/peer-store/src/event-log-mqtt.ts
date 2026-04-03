import { Assert } from '@gamezilla/shared/assert'
import type { EventLog, LogEntry } from './event-log'
import type { Event } from './types'

const crash: Assert = Assert.crash()

/**
 * Minimal MQTT publishing interface needed by {@link MqttEventLog}.
 *
 * Intentionally separate from peer-store's `Transport` because retained
 * messages are required and `Transport.publish` does not support them.
 */
export interface MqttPublisher {
  publish(
    topic: string,
    payload: string,
    options: { retain: boolean; qos: 0 | 1 },
  ): void
  subscribe(
    topic: string,
    handler: (payload: string) => void,
  ): () => void
}

/**
 * MQTT-backed EventLog that uses retained messages for event recovery.
 *
 * Only committed events are persisted (as a retained snapshot on
 * `{topicPrefix}/{gameId}/events`). Command and rejected entries are
 * no-ops — MQTT is used for event distribution, not a full WAL.
 *
 * `load` subscribes, receives the retained message, and returns the
 * committed entries.
 */
export class MqttEventLog implements EventLog {
  private readonly committed = new Map<string, Event[]>()

  constructor(
    private readonly mqtt: MqttPublisher,
    private readonly topicPrefix = 'games',
  ) {}

  async append(gameId: string, entry: LogEntry): Promise<void> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')

    if (entry.kind !== 'committed') return

    const existing = this.committed.get(gameId) ?? []
    const updated = [...existing, ...entry.events]
    this.committed.set(gameId, updated)

    this.mqtt.publish(
      `${this.topicPrefix}/${gameId}/events`,
      JSON.stringify(updated),
      { retain: true, qos: 1 },
    )
  }

  async load(gameId: string): Promise<LogEntry[]> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')

    return new Promise<LogEntry[]>((resolve) => {
      const topic = `${this.topicPrefix}/${gameId}/events`
      let resolved = false
      let unsubscribe: (() => void) | null = null

      unsubscribe = this.mqtt.subscribe(topic, (payload) => {
        if (resolved) return
        resolved = true
        unsubscribe?.()

        try {
          const events = JSON.parse(payload) as Event[]
          crash.array(events, 'retained events payload must be an array')

          this.committed.set(gameId, events)
          resolve([{ kind: 'committed', commandId: '__snapshot__', events }])
        } catch {
          resolve([])
        }
      })

      // If the retained message arrived synchronously during subscribe,
      // we're already resolved. Otherwise, resolve empty on next microtask.
      queueMicrotask(() => {
        if (resolved) return
        resolved = true
        unsubscribe?.()
        resolve([])
      })
    })
  }
}
