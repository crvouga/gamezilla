/**
 * PostgreSQL over the standard wire protocol using Bun's built-in {@link SQL}
 * driver (TCP/TLS — not Neon's HTTP `fetch` API and not the Neon WebSocket
 * `Client`, which PlanetScale Postgres does not speak reliably).
 *
 * {@link SqlClient#transaction} uses `sql.begin()` — real `BEGIN` / `COMMIT`
 * with isolation guarantees from Postgres.
 *
 * Re-exports {@link SqlClientImplBunPostgres}; prefer this module path when the
 * intent is “native TCP Postgres” in docs and infra wiring.
 */
export { SqlClientImplBunPostgres as SqlClientImplPostgresTcp } from './impl-bun-postgres';
