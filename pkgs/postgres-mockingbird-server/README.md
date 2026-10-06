# `@pkgs/postgres-mockingbird-server`

Local PostgreSQL protocol listeners backed by `@crvouga/mockingbird-service-postgres`.
`startMockingbirdPostgres` runs without native binaries; migrate/seed remain owned
by callers. Pass `port: 0` for isolated tests or a fixed port for local tools.
Snapshots use an injected object store, with a filesystem adapter at this
composition root. Orderly shutdown rolls back open transactions, atomically
stores `database.pgmm`, and the next start restores it. Native cluster files
are never deleted or converted; a first Mockingbird start uses a fresh database.

Crash-safe persistence is blocked by [Mockingbird #321](https://github.com/crvouga/mockingbird/issues/321).
The package cannot yet guarantee durable commits across an abrupt process exit.
Unresolved catalog and DDL behavior is pinned by the package tests; consumer
migrations must pass their full wire contracts before replacing a native engine.
