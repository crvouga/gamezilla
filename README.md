# gamezilla.app

## Run locally

Run one command:

| Command | Use |
| --- | --- |
| `bun start:localhost` | App, API and room Workers, Postgres, MinIO, EMQX, Google sign-in, and Stripe test mode |
| `bun start:localhost:mocked` | App with in-memory services and the dev account chooser |
| `bun start:in-process` | App and simulator at `/simulator` with in-memory services |

Each command prints its URL. Google sign-in needs dev credentials.

## Test

`bun test:product` runs the app tests in process. The same test cases run on
other fabrics without edits:

| Command | Fabric |
| --- | --- |
| `bun test:localhost:mocked` | Built browser app against the mocked in-process API on loopback |
| `bun e2e` | Full system: API and room Workers (`wrangler dev`), built browser app, Postgres, MinIO, EMQX |

`bun e2e` uses its own `e2e` database and resets it between tests, so dev data
is untouched. It needs the `bun start:localhost` ports free. Pass test files
(relative to `apps/product`) to focus a run: `bun e2e tests/shell-boot.test.tsx`.

## Architecture

<!-- TODO: update architecture diagram -->

**Dependency injection:** product `libs/` code uses constructor-injected classes for `SqlClient`, `CreateId`, and other shared deps. See [docs/dependency-injection.md](docs/dependency-injection.md).

## Security (local data)

Local SQLite databases on the web client are **not encrypted at rest**. Account data is **logically isolated** by using a **separate SQLite file per `users.id`** (`user_<shortId>`), so normal app code and typical query bugs cannot read another user’s rows while a different file is open. **Do not store on-device secrets or highly sensitive data** that would be unacceptable if a device is lost or compromised with filesystem access.

Auth is **token-only**: the API never reads or sets cookies. Every install has a real `users` row (`is_anon=true` until first sign-in upgrades that same id). Authenticated requests carry `Authorization: Bearer <session-token>`; all client requests also send the install UUID in `x-anon-id` for device binding. Sync JWT `sub` is always `users.id`.

### Single session

The client keeps **one current user per install**. Cold start / sign-out runs `POST /identity/anon/ensure` (anon `users` + profile). First Google OAuth sign-in (`@pkgs/auth` IdP) upgrades that anon row in place; a returning provider identity switches to the existing non-anon `users.id`. The dev account chooser is available in mocked and in-process runs, and on the full stack under `bun e2e` only.

**Restore multi-account later:** re-add `AuthClientPort.addAccount` / `switchAccount` (+ scoped `signOut`), a Kv roster for inactive display, `account-switch/*` chrome wired to sync boot readiness, warm multi-DB switch (disconnect sync without `disconnectAndClear`), auth-provider multi-session, and a switcher UI. Identity-keyed SQLite naming (`resolveSqliteDbName` + sync pool) already supports per-user files.
