# gamezilla.app

## Architecture

<!-- TODO: update architecture diagram -->

**Dependency injection:** product `libs/` code uses constructor-injected classes for `SqlClient`, `CreateId`, and other shared deps. See [docs/dependency-injection.md](docs/dependency-injection.md).

## Security (local data)

Local SQLite databases on the Expo client are **not encrypted at rest** (Expo Go cannot ship SQLCipher). Account data is **logically isolated** by using a **separate SQLite file per `users.id`** (`user_<shortId>`), so normal app code and typical query bugs cannot read another user’s rows while a different file is open. **Do not store on-device secrets or highly sensitive data** that would be unacceptable if a device is lost or compromised with filesystem access.

Auth is **token-only**: the API never reads or sets cookies. Every install has a real `users` row (`is_anon=true` until first sign-in upgrades that same id). Authenticated requests carry `Authorization: Bearer <session-token>`; all client requests also send the install UUID in `x-anon-id` for device binding. Sync JWT `sub` is always `users.id`.

### Single session

The client keeps **one current user per install**. Cold start / sign-out runs `POST /identity/anon/ensure` (anon `users` + profile). First Google OAuth sign-in (`@pkgs/auth` IdP) upgrades that anon row in place; a returning provider identity switches to the existing non-anon `users.id`. Dev social uses the same OAuth launch → callback → session exchange protocol for local/sim.

**Restore multi-account later:** re-add `AuthClientPort.addAccount` / `switchAccount` (+ scoped `signOut`), a Kv roster for inactive display, `account-switch/*` chrome wired to sync boot readiness, warm multi-DB switch (disconnect sync without `disconnectAndClear`), auth-provider multi-session, and a switcher UI. Identity-keyed SQLite naming (`resolveSqliteDbName` + sync pool) already supports per-user files.
