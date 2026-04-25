import { Assert } from '@gamezilla/lib/assert'
import type { EventLog, EventLogEntry } from './event-log'

const crash: Assert = Assert.crash()

/**
 * In-memory EventLog backed by a Map. Useful for tests and local dev.
 */
export class InMemoryEventLog implements EventLog {
  private readonly store = new Map<string, EventLogEntry[]>()

  async append(partitionKey: string, entry: EventLogEntry): Promise<void> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty')
    const rows = this.store.get(partitionKey) ?? []
    rows.push(entry)
    this.store.set(partitionKey, rows)
  }

  async load(partitionKey: string): Promise<EventLogEntry[]> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty')
    return [...(this.store.get(partitionKey) ?? [])]
  }
}
