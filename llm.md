# Gamezilla Architecture

We are building **Gamezilla** — a local-first, offline-first multiplayer game platform supporting many game types including chess, connect four, tic tac toe, battleship, sokoban, hangman, puzzles, and more. Built with Expo + React Native + TypeScript on the client and Bun + Node.js on the server.

---

## Patch DB (app state only)

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

**Patch DB entity types:**

- `user_profile` — accounts, settings, display name, avatar
- `user_session` — active sessions
- `puzzle` — puzzle definitions and content
- `puzzle_metadata` — difficulty, tags, author
- `game_metadata` — results, ratings, history, outcome
- `game_room` — lobby, settings, invites
- `space` — social spaces, communities
- `matchmaking` — queue entries, match requests
- `username_reservation` — unique username claims

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

## Auth (Better Auth)

- Google Sign-In + Apple Sign-In as identity anchors
- Email as cross-provider identity link — same email on Google and Apple = same user
- Passkeys for daily device authentication via biometrics
- Better Auth backed by SQLite file on Railway persistent volume — no Postgres needed
- Device keypairs stored in secure enclave
- Relay verifies signatures against registered public keys on every request
- `WithAuthContext` decorator auto-fills `createdBy` and `sessionId` on every patch write

---

## Business Rules (hook registry)

Same hooks run optimistically on client and authoritatively on relay:

```typescript
hooks.onBeforeRead(async (ctx) => { ... });   // filter queries
hooks.onAfterRead(async (ctx) => { ... });    // filter results
hooks.onBeforeWrite(async (ctx) => { ... });  // validate, ownership
hooks.onAfterWrite(async (ctx) => { ... });   // side effects, moderation
```

Used for:

- Ownership validation — users can only write their own entities
- Unique username enforcement — `username_reservation` entity
- Read filtering — users only see entities they have access to
- Content moderation — async OpenAI moderation API on `onAfterWrite`, tombstone flagged patches

---

## Infrastructure

| Component         | Technology               | Notes                                         |
| ----------------- | ------------------------ | --------------------------------------------- |
| Patch relays      | Railway                  | Stateless, auto-replicas, HTTP + SSE          |
| Game servers      | Railway                  | In-memory game process + stateless WS fan-out |
| Trusted observers | Railway                  | One process per active competitive game       |
| Frontend          | Vercel                   | Static, CDN                                   |
| Auth DB           | SQLite on Railway volume | Better Auth, no Postgres needed               |
| App state backup  | Google Drive / iCloud    | User-owned, zero cost                         |
| Admin patches     | Cloudflare R2            | Featured puzzles, app-wide content            |

---

## Cost

Zero ops engineering — push code, done.

---

## Key Design Principles

- **Two separate systems:** Patch DB for app state, event sourcing for game state — never mixed
- **Three tiers of trust:** client (optimistic) → relay (app state authority) → observer (game state authority)
- **Local-first:** client SQLite is source of truth — relay is coordination, not authority
- **Append-only:** no migrations ever, no retracts, soft deletes only
- **Signed patches:** tamper-proof, enables P2P and community relays
- **Modular games:** all game types share infrastructure, each implements own state machine
- **Swappable layers:** `PatchDb`, `PatchTransport`, `BackupTransport` are all interface-driven
- **Postgres optional:** system works without it — swap in via `PatchDb` interface when needed
