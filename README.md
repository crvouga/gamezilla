# gamezilla.app

## Architecture

<!-- TODO: update architecture diagram -->

## Security (local data)

Local SQLite databases on the Expo client are **not encrypted at rest** (Expo Go cannot ship SQLCipher). Account data is **logically isolated** by using a **separate SQLite file per account** (and a dedicated anonymous file before sign-in), so normal app code and typical query bugs cannot read another account’s rows while a different account’s file is open. **Do not store on-device secrets or highly sensitive data** that would be unacceptable if a device is lost or compromised with filesystem access.

Auth is **token-only**: the API never reads or sets cookies. Authenticated requests carry `Authorization: Bearer <session-token>`; anonymous patch-db requests carry the local device UUID in the `x-anon-id` header. The same device UUID names the anonymous SQLite file before sign-in.
