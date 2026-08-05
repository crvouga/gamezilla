# gamezilla.app

## Architecture

<!-- TODO: update architecture diagram -->

## Security (local data)

Local SQLite databases on the Expo client are **not encrypted at rest** (Expo Go cannot ship SQLCipher). Account data is **logically isolated** by using a **separate SQLite file per account** (and a dedicated anonymous file before sign-in), so normal app code and typical query bugs cannot read another account’s rows while a different account’s file is open. **Do not store on-device secrets or highly sensitive data** that would be unacceptable if a device is lost or compromised with filesystem access.

Auth is **token-only**: the API never reads or sets cookies. Authenticated requests carry `Authorization: Bearer <session-token>`; anonymous sync requests carry the local device UUID in the `x-anon-id` header. The same device UUID names the anonymous SQLite file before sign-in.

### Single session

The client keeps **one signed-in account per install**. Sign-in opens that account’s `acct_<accountId>` SQLite file; sign-out returns to the anonymous `anon_<deviceId>` file. Turn off the auth-provider dashboard **Multi-session handling** so a new sign-in replaces rather than stacks provider sessions.

**Restore multi-account later:** re-add `AuthClientPort.addAccount` / `switchAccount` (+ scoped `signOut`), a Kv roster for inactive display, `account-switch/*` chrome wired to sync boot readiness, warm multi-DB switch (disconnect sync without `disconnectAndClear`), auth-provider multi-session, and a switcher UI. Identity-keyed SQLite naming (`resolveSqliteDbName` + PowerSync pool) already supports per-account files.
