# Dependency injection

Product code in `libs/` injects shared dependencies (**`SqlClient`**, **`CreateId`**, loggers, publishers, etc.) via **constructor-injected classes**. Exported top-level functions must not take those dependencies as parameters.

CI enforces this with `bun run ci:no-top-level-di-functions` ([`tools/scripts/check-no-top-level-di-functions.ts`](../tools/scripts/check-no-top-level-di-functions.ts)).

## Do convert

Exported helpers whose parameters include an injected dependency (positional or args bag): DB clients, ID generators, loggers, config services, Stripe clients, publishers, and so on.

## Do not convert

- Pure helpers with no injected dependency (row mappers, formatters, validators, pair-id helpers).
- `defineMutation` / `defineQuery` `run` handlers — framework already injects `{ tx, env }` / query context.
- React components (PascalCase) and hooks (`useX`) — they use props / context.
- `wallIo()` composition roots and `@io-wall-ok` entry files.
- `@pkgs/sync-engine` internals and `createSyncApp` / `createLocalSyncEngine` dep bags.
- `libs/infra` CLI (`CiPlatform` / `InfraContext`).

## Canonical shape

```typescript
// Pure helpers stay module-level
function mapFriendRequest(row: Record<string, unknown>): FriendRequest { /* … */ }

export class FriendRequestRepository {
  constructor(private readonly db: SqlClient) {}

  async findById(requestId: string): Promise<FriendRequest | null> {
    const rows = await this.db.query(sql`…`);
    const row = rows[0];
    return row === undefined ? null : mapFriendRequest(row);
  }
}

export class FriendBlockService {
  constructor(
    private readonly sql: SqlClient,
    private readonly createId: CreateId,
    private readonly inboxPublisher: FriendsInboxPublisher
  ) {}

  async block(blockerId: string, blockedId: string, now: string): Promise<void> {
    await this.sql.transaction(async (tx) => {
      // Transaction-scoped instances are expected (local `tx`, not a top-level DI param).
      const friendshipRepo = new FriendshipRepository(tx);
      const blockRepo = new UserBlockRepository(tx, this.createId);
      await friendshipRepo.delete(blockerId, blockedId, now);
      await blockRepo.insertManaged(blockerId, blockedId, now);
    });
  }
}
```

Suffix classes by role: `XRepository` (DB), `XService` (orchestration), `XPublisher` (outbound events).

## Composition root (request-scoped)

SQL is per-request (AsyncLocalStorage). Do **not** hold a process-global `SqlClient`.

[`ApiRequestContainer`](../apps/api/src/app/api-request-container.ts) is built in [`request-db-middleware.ts`](../apps/api/src/app/request-db-middleware.ts) when the request DB opens, and stored on [`ApiRequestAsyncStore.container`](../apps/api/src/request-scope.ts). Wire new server repositories/services there as they land.

Inside mutations:

```typescript
async run({ tx, env }, args) {
  await new FriendshipRepository(tx).softDelete(actor, userId, env.now().toISOString());
}
```

## Naming

Method names drop the prefix the class already implies (`findFriendRequestById` → `findById` on `FriendRequestRepository`).
