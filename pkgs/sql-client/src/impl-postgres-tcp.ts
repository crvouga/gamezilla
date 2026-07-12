/**
 * PostgreSQL over the standard wire protocol using Bun's built-in {@link SQL}
 * driver (TCP/TLS — not HTTP/WebSocket Postgres adapters).
 *
 * {@link SqlClient#transaction} uses `sql.begin()` — real `BEGIN` / `COMMIT`
 * with isolation guarantees from Postgres.
 *
 * Re-exports {@link SqlClientImplBunPostgres}; prefer this module path when the
 * intent is “native TCP Postgres” in docs and infra wiring.
 *
 * Connection strings are sanitized (e.g. `sslrootcert` removed) before Bun
 * `SQL` opens TCP — managed URLs may include libpq-only TLS keys.
 */
export { SqlClientImplBunPostgres as SqlClientImplPostgresTcp } from './impl-bun-postgres';
