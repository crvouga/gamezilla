import { Assert } from '@gamezilla/shared/assert'
import type { SqlClient } from '@gamezilla/shared/sql-client/interface'
import type { EventLog, LogEntry } from './event-log'
import type { Command, Event } from './types'

const crash: Assert = Assert.crash()

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS event_log (
    game_id    TEXT NOT NULL,
    seq        INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    command_id TEXT NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (game_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_event_log_game ON event_log (game_id);
`

const INSERT = `INSERT INTO event_log (game_id, seq, kind, command_id, payload, created_at)
VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM event_log WHERE game_id = ?), ?, ?, CAST(? AS jsonb), NOW())`

const SELECT = `SELECT kind, command_id, payload FROM event_log
WHERE game_id = ? ORDER BY seq ASC`

type Row = { kind: string; command_id: string; payload: unknown }

function entryToRow(entry: LogEntry): { kind: string; commandId: string; payload: string } {
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
        payload: JSON.stringify(entry.events),
      }
    case 'rejected':
      return {
        kind: 'rejected',
        commandId: entry.commandId,
        payload: '{}',
      }
  }
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload === 'string') return JSON.parse(payload)
  return payload
}

function rowToEntry(row: Row): LogEntry {
  switch (row.kind) {
    case 'command':
      return { kind: 'command', command: parsePayload(row.payload) as Command }
    case 'committed':
      return {
        kind: 'committed',
        commandId: row.command_id,
        events: parsePayload(row.payload) as Event[],
      }
    case 'rejected':
      return { kind: 'rejected', commandId: row.command_id }
    default:
      crash.fail('unknown event_log kind', { kind: row.kind })
  }
}

/**
 * PostgreSQL-backed EventLog using JSONB for structured payload storage
 * and TIMESTAMPTZ for timestamps. Uses `SqlClient` with `?` placeholders
 * (converted to `$N` by the Postgres SqlClient implementation).
 *
 * The `node-postgres` driver returns JSONB columns as already-parsed JS
 * objects, so `rowToEntry` handles both string and object payloads.
 */
export class PostgresEventLog implements EventLog {
  constructor(private readonly sqlClient: SqlClient) {}

  async migrate(): Promise<void> {
    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await this.sqlClient.run(stmt)
    }
  }

  async append(gameId: string, entry: LogEntry): Promise<void> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')
    const { kind, commandId, payload } = entryToRow(entry)
    await this.sqlClient.run(INSERT, [gameId, gameId, kind, commandId, payload])
  }

  async load(gameId: string): Promise<LogEntry[]> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')
    const rows = await this.sqlClient.query<Row>(SELECT, [gameId])
    return rows.map(rowToEntry)
  }
}
