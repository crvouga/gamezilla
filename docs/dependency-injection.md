# Dependency injection

Product code uses **three layers**. Do not blur them.

CI enforces the model with:

- `bun run ci:no-top-level-di-functions` — no exported top-level functions taking injectable deps
- `bun run ci:no-eager-di-construction` — no `this.x = new …` / field-init / module-level Layer C construction
- `bun run ci:layer-c-sql-tx` — Layer C constructors must not take bare `SqlClient`
- `bun run ci:no-di-container` — no `*Container` / `*Registry` / `*ServiceLocator` classes

Scripts live under [`tools/scripts/check-*.ts`](../tools/scripts/). These gates expect zero violations (no baseline files).

## Three layers

### Layer A — Primitives (long-lived)

Only `SqlClient` plus injected time/entropy (`Clock`, `createId`, `Timers`, HTTP). Created at process/request entry (`createClient(env)` / `createServer(env)` / `createSim`) and threaded through request context. **No `Io` bag, no repositories, no services, no container class.**

```typescript
export interface AppContext {
  readonly db: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
}
```

### Layer B — Use cases (cheap, primitive-injected)

One class per endpoint / use case. Constructor takes primitives only — `(db: SqlClient, { clock, createId })`. Constructing one is free; there is nothing to eagerly build.

- **Writes:** each public method opens `db.transaction` and constructs Layer C inside the callback.
- **Reads:** construct Layer C with the request `db` as `SqlTx` **without** opening a write transaction (there is no `readTransaction` API; wrapping pure reads in `BEGIN` is wasteful).

```typescript
export class BlockUserUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly clock: Clock
  ) {}

  async execute(blockerId: string, blockedId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const inboxPublisher = new FriendsInboxPublisher(tx, this.clock);
      const service = new FriendBlockService(tx, this.clock, inboxPublisher);
      await service.block(blockerId, blockedId);
    });
  }
}

// Call site:
await new BlockUserUseCase(ctx.db, ctx.clock).execute(blockerId, blockedId);
```

**Use cases must not call other use cases.** Nested `transaction()` flattens on the production node-pg path and throws on PGlite — there are no savepoints. Shared logic belongs in a Layer C service that takes the existing `tx`.

### Layer C — Repositories, services, publishers (transaction-scoped, ephemeral)

**Constructor takes `SqlTx`, never `SqlClient`.** `SqlTx` is `Pick<SqlClient, 'query' | 'run'>` from `@pkgs/sql-client/interface` — both a transaction handle and the request client satisfy it, so the type system prevents “container-held repo with a full client” while still allowing read use cases to pass `db` directly.

Pass `clock` / `createId` rather than an `Io` bag. Call `this.clock.now()` **per operation** — do not capture `now` at construction (stale timestamps on long requests).

```typescript
export class FriendRequestRepository {
  constructor(
    private readonly tx: SqlTx,
    private readonly clock: Clock
  ) {}

  async findById(requestId: string): Promise<FriendRequest | null> {
    const rows = await this.tx.query(sql`…`);
    const row = rows[0];
    return row === undefined ? null : mapFriendRequest(row);
  }
}
```

Service-to-service deps are constructed inline in the same transaction scope:

```typescript
await this.db.transaction(async (tx) => {
  const inboxPublisher = new FriendsInboxPublisher(tx, this.clock);
  const statusService = new FriendshipStatusService(tx, this.clock, inboxPublisher);
  return statusService.backfillFriendRequestInboxInteractions(viewerId);
});
```

If wiring repeats across several use cases (~4+ lines), extract a **factory function** `(tx, clock) => …` — never a class that holds constructed objects:

```typescript
export function createFriendsInboxPublisher(tx: SqlTx, clock: Clock): FriendsInboxPublisher {
  return new FriendsInboxPublisher(tx, clock);
}
```

Suffix classes by role: `XRepository` (DB), `XService` (orchestration), `XPublisher` (outbound events), `XHandler` (inbox/action handlers). Never store a Layer C instance on a field of anything longer-lived than a transaction callback (or the read use-case method for pure reads).

## Superseded guidance

The following patterns are **outdated** — do not copy them:

| Superseded | Replace with |
| ---------- | ------------ |
| `ApiRequestContainer` eagerly holding repos/services | Request ALS carries `sqlClient` + `clock` / `createId`; `new SomeUseCase(db, clock).execute(…)` |
| `constructor(private readonly db: SqlClient)` on a repository/service/publisher | `constructor(private readonly tx: SqlTx, private readonly clock: Clock)` |
| An `Io` bag (`wallIo` / `createSimIo` / `getIo`) | Pass `clock` / `createId` / `timers` / HTTP from `ClientEnv` / `ServerEnv` |
| Wiring new server classes into a central container | Construct Layer C at the point of use inside the use case |

Do not reintroduce a container/registry class. Factory functions are the only wiring escape hatch.

## Do convert

Exported helpers whose parameters include an injected dependency (positional or args bag): DB clients, ID generators, loggers, config services, Stripe clients, publishers, and so on — put them on a class constructor (Layer B or C as appropriate).

## Do not convert

- Pure helpers with no injected dependency (row mappers, formatters, validators, pair-id helpers).
- `defineMutation` / `defineQuery` `run` handlers — framework already injects `{ tx, env }` / query context. Inside mutations, `new XRepository(tx)` (tx is already `SqlTx`-shaped) is correct.
- React components (PascalCase) and hooks (`useX`) — they use props / context.
- `@io-wall-ok` composition roots (`wallClock` / `wallTimers` / `crypto.randomUUID`).
- `@pkgs/sync-engine` internals and `createSyncApp` / `createLocalSyncEngine` dep bags.
- `libs/infra` CLI (`CiPlatform` / `InfraContext`).

## Naming

Method names drop the prefix the class already implies (`findFriendRequestById` → `findById` on `FriendRequestRepository`).
