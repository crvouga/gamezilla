# Gamezilla

A local-first, offline-first multiplayer game platform. What the app is
is specified in [`specs/`](specs/); how to work in the repo is
[`AGENTS.md`](AGENTS.md). Docs under [`docs/`](docs/) are implementation.

## Principles

- **Tiger Style** ([TigerBeetle's](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md),
  adapted for TypeScript). Assert invariants and crash when one breaks —
  silent corruption is worse than a crash. Handle or propagate every error;
  no swallowed promises, no `catch {}`. No hidden control flow: every
  dependency is injected, every side effect named.
- **Local-first.** Reads and writes hit the device's SQLite and never wait
  on the network; changes sync when a connection exists. The behavior is
  specified in [`specs/`](specs/).
- **Deterministic simulation.** Time, timers, ids, randomness and the network
  are injected ([`docs/DETERMINISM.md`](docs/DETERMINISM.md)), so many clients,
  their faults and their convergence run in-process on virtual time, in
  milliseconds.
- **Everything is code.** Infrastructure is OpenTofu
  ([`docs/INFRA.md`](docs/INFRA.md)); a merge to `main` deploys.

## Architecture

- **Sync.** Clients read local SQLite and write through mutations, applied
  locally at once and queued for upload. The server replays them in one
  Postgres transaction as the signed-in person and pushes changes to every
  subscribed device. Conflicts resolve in server arrival order (last write
  wins). Rows are never hard-deleted: removal sets `deleted_at`.
- **Rooms.** `@pkgs/room` runs server-authoritative sessions per topic
  (for example `space:<id>`). A shared `RoomModule` holds the game rules: the
  client runs it for instant feedback, the server to validate and order. See
  [`pkgs/room/README.md`](pkgs/room/README.md).

## Security (local data)

Local SQLite on the web client is **not encrypted at rest**. Each account
gets its own SQLite file (`user_<shortId>`), so app code and ordinary query
bugs cannot read another account's rows. Never store on-device secrets or
data that would be unacceptable to lose with a device.

Auth is token-only: the API never reads or sets cookies. Every install has a
real `users` row (`is_anon=true` until the first sign-in upgrades that same
id). Requests carry `Authorization: Bearer <session-token>` and the install
UUID in `x-anon-id`. The client keeps one current user per install; a person
can hold several sign-in methods on one account.
