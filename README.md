# gamezilla.app

## Architecture

<!-- TODO: update architecture diagram -->

## Security (local data)

Local SQLite databases on the Expo client are **not encrypted at rest** (Expo Go cannot ship SQLCipher). Account data is **logically isolated** by using a **separate SQLite file per account** (and a dedicated anonymous file before sign-in), so normal app code and typical query bugs cannot read another account’s rows while a different account’s file is open. **Do not store on-device secrets or highly sensitive data** that would be unacceptable if a device is lost or compromised with filesystem access.

Server-issued HTTP `clientId` is echoed on `GET /auth/client-id` for naming the anonymous database file (the cookie itself remains httpOnly).
