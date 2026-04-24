import { Assert } from '@gamezilla/lib/assert'
import type { SqlClient } from '@gamezilla/lib/sql-client/interface'
import type { EventLog, EventLogEntry } from './event-log'
import { assertCommand, assertLogEntryArray } from './assert-durable-json'

const crash: Assert = Assert.crash()

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS event_log (
    partition_key TEXT NOT NULL,
    seq        INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    command_id TEXT NOT NULL,
    payload    TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    PRIMARY KEY (partition_key, seq)
);
CREATE INDEX IF NOT EXISTS idx_event_log_partition ON event_log (partition_key);
`

const INSERT = `INSERT INTO event_log (partition_key, seq, kind, command_id, payload, created_at)
VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM event_log WHERE partition_key = ?), ?, ?, ?, ?)`

const SELECT = `SELECT kind, command_id, payload FROM event_log
WHERE partition_key = ? ORDER BY seq ASC`

type Row = { kind: string; command_id: string; payload: string }

function entryToRow(entry: EventLogEntry): {
  kind: string
  commandId: string
  payload: string
} {
  switch (entry.kind) {
    case 'command':
      return {
        kind: 'command',
        commandId: entry.command.id,
        payload: JSON.stringify(entry.command),
      }
    case 'committed':
      return {
        kind: 'committed',
        commandId: entry.commandId,
        payload: JSON.stringify(entry.entries),
      }
    case 'rejected':
      return {
        kind: 'rejected',
        commandId: entry.commandId,
        payload: '{}',
      }
  }
}

function rowToEntry(row: Row): EventLogEntry {
  switch (row.kind) {
    case 'command':
      return { kind: 'command', command: assertCommand(JSON.parse(row.payload)) }
    case 'committed':
      return {
        kind: 'committed',
        commandId: row.command_id,
        entries: assertLogEntryArray(JSON.parse(row.payload)),
      }
    case 'rejected':
      return { kind: 'rejected', commandId: row.command_id }
    default:
      crash.fail('unknown event_log kind', { kind: row.kind })
  }
}

/**
 * SQLite-backed EventLog using TEXT columns and JSON stored as strings.
 * Uses `SqlClient` with `?` placeholders (native to SQLite).
 */
export class SqliteEventLog implements EventLog {
  constructor(private readonly sqlClient: SqlClient) {}

  async migrate(): Promise<void> {
    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await this.sqlClient.run(stmt)
    }
  }

  async append(partitionKey: string, entry: EventLogEntry): Promise<void> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty')
    const { kind, commandId, payload } = entryToRow(entry)
    const now = new Date().toISOString()
    await this.sqlClient.run(INSERT, [
      partitionKey,
      partitionKey,
      kind,
      commandId,
      payload,
      now,
    ])
  }

  async load(partitionKey: string): Promise<EventLogEntry[]> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty')
    const rows = await this.sqlClient.query<Row>(SELECT, [partitionKey])
    return rows.map(rowToEntry)
  }
}
