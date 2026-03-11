# Gamezilla Architecture

We are building **Gamezilla** — a local-first, offline-first multiplayer game platform supporting many game types including chess, connect four, tic tac toe, battleship, sokoban, hangman, puzzles, and more. Built with Expo + React Native + TypeScript on the client and Bun + Node.js on the server.

---

## Patch DB

Gamezilla uses a Patch DB abstraction for all application data.

A Patch DB is:

- Append-only
- Conflict-tolerant
- Replayable
- Sync-friendly

Clients materialize entities locally from patches.

We split Patch DB into two logical systems based on authority.

---

## Patch DB Types

### 1. Server-Owned Durable Patch DB

Backed by Postgres. Used for security-critical and globally authoritative data.

**Entity types:**

- `account`
- `account_link`
- `principal`
- `account_principal_link`
- `linked_identity`
- `username_reservation`
- `entitlement`
- `ban`

**Properties:**

- Server authoritative
- Durable
- Globally consistent
- Validated before write
- Supports uniqueness constraints

Clients cannot write these entities directly. Instead they call server commands such as:

```typescript
linkGoogleIdentity;
createAccount;
reserveUsername;
```

The server writes the resulting patches.

**Purpose:** Provides a global identity and security layer while still exposing the same Patch DB interface to clients.

---

### 2. Client-Owned Decentralized Patch DB

Used for local-first application state. Backed by SQLite on client, relay servers, and optional user backups.

**Entity types:**

- `puzzle_completion`
- `puzzle_progress`
- `user_profile`
- `puzzle`
- `puzzle_metadata`
- `game_room`
- `space`
- `matchmaking`
- `game_metadata`

**Properties:**

- Client-first writes
- Append-only patches
- Eventual sync
- Offline for weeks
- User-owned durability

This is the primary application data layer.

---

## Federated Patch DB (Client)

Clients interact with a federated Patch DB:

```
FederatedPatchDb
   ├── ServerPatchDb
   └── ClientPatchDb
```

Queries are routed based on entity type:

```typescript
db.entities({ entityType: "account" });
// → server patch db

db.entities({ entityType: "puzzle_completion" });
// → client patch db
```

This allows the client to treat both systems as a single logical database.

---

## Patch DB Schema

Single append-only `patches` table:

```typescript
type Patch = {
  patchId: string;
  entityId: string;
  entityType: string;
  attributes: Record<string, unknown>; // merged, latest value per key wins
  createdAt: string;
  recordedAt: string;
  parentId: string | null;
  createdBy: string;
  sessionId: string | null;
  metadata: Record<string, unknown>;
};

type Entity = {
  entityId: string;
  entityType: string;
  updatedAt: string;
  updatedBy: string;
  attributes: Record<string, unknown>;
};
```

**Rules:**

- Append-only — patches are never deleted or retracted
- Soft deletes via tombstone: `{ deleted: true }` or null attribute: `{ username: null }`
- Merge resolution only — latest value per attribute key wins across all patches for an entity
- No joins — single entity queries only, waterfall is fine on local SQLite

**Interface:**

```typescript
interface PatchDb {
  write(patches: Patch[]): Promise<void>;
  patches(query: PatchDbQuery): Promise<PatchDbResult<Patch>>;
  entities(query: PatchDbQuery): Promise<PatchDbResult<Entity>>;
}

type PatchDbQuery = {
  entityType: string;
  entityId?: string | string[];
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  limit?: number;
  offset?: number;
  after?: string; // cursor pagination
};

type PatchDbQueryWhereClause =
  | { type: "="; attribute: string; value: unknown }
  | { type: "!="; attribute: string; value: unknown }
  | { type: "in"; attribute: string; values: unknown[] }
  | { type: "not_in"; attribute: string; values: unknown[] }
  | { type: "gt"; attribute: string; value: unknown }
  | { type: "gte"; attribute: string; value: unknown }
  | { type: "lt"; attribute: string; value: unknown }
  | { type: "lte"; attribute: string; value: unknown }
  | { type: "contains"; attribute: string; value: string }
  | { type: "exists"; attribute: string }
  | { type: "not_exists"; attribute: string }
  | { type: "or"; clauses: PatchDbQueryWhereClause[] }
  | { type: "and"; clauses: PatchDbQueryWhereClause[] }
  | { type: "not"; clause: PatchDbQueryWhereClause };

type PatchDbResult<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};
```

**Decorators:**

- `WithHooks` — business rules, validation, moderation
- `WithSubscriptions` — polling-based live queries
- `WithGoogleDriveBackup` — transparent client backup
- `WithAuthContext` — auto-fills `createdBy` and `sessionId`

**Client:** SQLite via better-sqlite3  
**Server:** same schema, swappable to Postgres via `PatchDb` interface

---

## Identity Model

Gamezilla separates accounts, account links, principals, devices, and provider identities. This enables:

- Guest-first onboarding
- Local-first ownership
- Cross-device identity
- Explicit multi-account linking
- Social login

### Account

An account is created the first time a user signs in with a provider identity.

```
accountId
```

- Created by server on first provider login
- Each provider identity maps to exactly one account
- Accounts are independent — never automatically merged
- Multiple accounts may belong to the same logical user via explicit linking

### Account Link

Represents that two accounts belong to the same logical user.

```
account_link(A1, A2)
```

- Account links form a connected graph
- The logical user is the set of all accounts reachable through `account_link` relationships
- Linking is always explicit — never triggered by login
- Unlinking removes the `account_link` entity — no destructive migration required
- Accounts themselves are never merged

### Principal

A local acting identity that owns entities.

```
principalId
```

- Generated locally on device
- Used for entity ownership
- Linked to an account via `account_principal_link`
- Multiple principals may belong to one account

**Example:**

```
Device A → principalId = P1 → accountId = A1
Device B → principalId = P2 → accountId = A1
// A1 and A2 may later be linked explicitly
```

### Provider Identity

External authentication identity.

```
provider
providerUserId
```

- Provider identities are globally unique
- Mapping: `(provider, providerUserId) → accountId`
- Login never performs account linking
- If a provider identity already exists, login resolves to that account
- Otherwise a new account is created

### Device Identity

Used for signing patches.

```
deviceId
publicKey
```

### Entity Ownership

All entities are owned by a principal:

```typescript
puzzle_completion.completedByPrincipalId;
```

This ensures a consistent write path, no ownership migration, and correct authorship history.

### Querying User Data

To fetch all entities for the current logical user:

1. Get the current `accountId` from the session
2. Resolve all linked account IDs via `account_link`
3. Resolve all `principalId`s for those accounts
4. Query entities using `IN` clause

```typescript
const accountIds = resolveLinkedAccounts(accountId);

const principalIds = getPrincipalsForAccounts(accountIds);

db.query({
  entityType: "puzzle_completion",
  where: {
    type: "in",
    attribute: "completedByPrincipalId",
    values: principalIds,
  },
});
```

Guest users simply return `[localPrincipalId]`.

---

## Auth

Gamezilla uses Google and Apple Sign-In as identity anchors.

**Login flow:**

1. Device creates local `principalId`
2. User signs in with provider
3. Server verifies provider token
4. Server checks `(provider, providerUserId)`
5. If found → use existing account
6. If not found → create new account
7. Server links `principalId → accountId`
8. Client syncs account data

Login never links accounts. Each provider identity resolves to exactly one account.

**Explicit account linking:**

Users may link accounts manually after login:

1. User is authenticated as account A
2. User authenticates ownership of account B
3. Server creates `account_link(A, B)`
4. Both accounts now belong to the same logical user

Unlinking removes the `account_link` entity. No data is merged or migrated.

**Security rules:**

- `(provider, providerUserId)` must be globally unique
- Account linking requires authentication of both accounts
- Login never triggers linking
- Principals cannot be reassigned by clients
- Device keypairs stored in secure enclave
- Relay verifies signatures against registered public keys on every request
- `WithAuthContext` decorator auto-fills `createdBy` and `sessionId` on every patch write

---

## Game State (event sourcing + consensus)

Game state is **never** stored in Patch DB. It is ephemeral, in-memory, and event-sourced.

**Event sourcing model:**

- All game events (moves, actions, clock ticks) appended to in-memory event log per game
- Current state derived by replaying events: `snapshot + delta events = current state`
- Periodic snapshots cap replay cost
- On game end: final result and ratings written to Patch DB as `game_metadata`

**Stateless WebSocket fan-out:**

- Stateless WS servers distribute events and snapshots to connected clients
- Game state lives in dedicated in-memory game process — not in WS servers
- Clients reconstruct game state locally from received events + snapshots

**Trusted observers (competitive games):**

- Observer servers independently track authoritative game state for ranked play
- Observers validate moves — detect cheating, illegal moves, desync
- Observer is source of truth for competitive outcomes — their record is final
- On game end, observer writes result to Patch DB — not the client
- Casual games run without observers — client consensus sufficient
- Observer pattern is game-agnostic — same architecture for all game types

**Supported game types:**

- Turn-based: chess, connect four, tic tac toe, battleship, hangman, sokoban
- Puzzle: solo puzzles, daily challenges, puzzle rush
- All games share: event sourcing model, WS fan-out infrastructure, Patch DB for metadata, observer pattern
- Each game defines: event schema, state machine, move validator, snapshot format
- Adding a new game = implement game-specific state machine and validator only

---

## Sync (decentralized, local-first)

**Patches are cryptographically signed** by client keypair — relay cannot forge or tamper.

**Interface:**

```typescript
interface PatchTransport {
  push(patches: Patch[]): Promise<void>;
  pull(cursors: SyncCursor[]): Promise<Patch[]>;
}
```

**Implementations:**

- `RelayTransport` — HTTP + SSE to relay server
- `LocalNetworkP2P` — mDNS discovery + direct TCP on same WiFi
- `BluetoothP2P` — BLE for nearby offline sync
- `FederatedTransport` — combines multiple transports, deduplicates by patchId

**Relay servers:**

- Stateless, in-memory SQLite, HTTP + SSE only (no WebSockets)
- Consistent hashing by query — same query always hits same relay node
- Round-robin load balancing across replicas
- Community-supported relays possible — signed patches make untrusted relays safe
- Railway deployment: single node at lichess scale, up to 50 replicas at chess.com scale

---

## Durability (client-owned)

No server-side database required for app state.

- **Primary:** client SQLite — always available, source of truth
- **Backup:** Google Drive (Android) or iCloud (iOS) via `BackupTransport` interface
- **Optional:** Cloudflare R2 via server proxy for centralized backup
- Backup deletion is safe — client recreates from local SQLite anytime
- Multi-device sync: Google/Apple identity anchor + backup restore on new device
- Game state: observer writes final result to Patch DB on game end

```typescript
interface BackupTransport {
  backup(patches: Patch[]): Promise<void>;
  restore(cursor?: string): Promise<Patch[]>;
  getLastCursor(): Promise<string | null>;
  pruneOldBackups(): Promise<void>;
}
```

---

## Business Rules (hook registry)

Same hooks run optimistically on client and authoritatively on relay:

```typescript
hooks.onBeforeRead(async (ctx) => { ... });  // filter queries
hooks.onAfterRead(async (ctx) => { ... });   // filter results
hooks.onBeforeWrite(async (ctx) => { ... }); // validate, ownership
hooks.onAfterWrite(async (ctx) => { ... });  // side effects, moderation
```

Used for:

- Ownership validation — users can only write their own entities
- Unique username enforcement — `username_reservation` entity
- Read filtering — users only see entities they have access to
- Content moderation — async OpenAI moderation API on `onAfterWrite`, tombstone flagged patches

---

## Infrastructure

| Component         | Technology            | Notes                                         |
| ----------------- | --------------------- | --------------------------------------------- |
| Durable Patch DB  | Postgres              | Server authoritative                          |
| Patch Relays      | Railway               | Stateless, auto-replicas, HTTP + SSE          |
| Game Servers      | Railway               | In-memory game process + stateless WS fan-out |
| Trusted Observers | Railway               | One process per active competitive game       |
| Frontend          | Vercel                | Static, CDN                                   |
| Client DB         | SQLite                | Primary app state                             |
| User Backups      | Google Drive / iCloud | Optional durability                           |
| Admin Patches     | Cloudflare R2         | Featured puzzles, app-wide content            |

---

## Cost

Zero ops engineering — push code, done.

---

## Key Design Principles

- **Two Patch DB systems:** server-authoritative for identity/security, client-owned for app state
- **Federated client database:** unified query layer across both systems
- **Guest-first identity:** no login required to start
- **Principal-based ownership:** simple, consistent write path
- **Explicit account linking:** accounts are never automatically merged — linking is always user-initiated
- **No account merging:** `account_link` connects accounts into a logical user without destructive migration
- **Logical user = linked account set:** all accounts reachable via `account_link` belong to the same user
- **Local-first:** client SQLite is source of truth — relay is coordination, not authority
- **Append-only history:** no destructive migrations, ever
- **Signed patches:** tamper-proof, enables P2P and community relays
- **Server authority where required:** identity, uniqueness, and security
- **Modular game engines:** all game types share infrastructure, each implements own state machine
- **Swappable layers:** `PatchDb`, `PatchTransport`, `BackupTransport` are all interface-driven
