# Sim mem-engine wishlist

Wishlist / known gaps for `@crvouga/postgres-mem` and `@crvouga/sqlite-mem`
when used as the sim SQL fabric (`SIM_SQL_BACKEND=mem`).

Playground default today is **mem** (`DEFAULT_SIM_SQL_BACKEND = 'mem'` in
`product/console/src/sim/sim-sql-backend.ts`) even when docs say plan-default
`real`. Native Expo always uses mem (Hermes cannot load PGlite / better-sqlite3).

Product schema maps logical `integer` → Postgres physical **`bigint`**
(`pkgs/db-schema` `PG_TYPE_SQL`). App-side `normalizePgInt8*` only rewrites
**returned** rows — it cannot fix arithmetic that throws inside the engine.

---

## BUG: int8 `toI8` leaves JS `number` → `addI` mixes BigInt

### Symptom

- **Chrome / V8:** `TypeError: Cannot mix BigInt and other types, use explicit conversions`
- **Bun:** `Invalid mix of BigInt and other type in addition`

Seen in playground on `POST /api/query` 500 and during pubsub push-seq allocate
(`notifyChannels` → `allocateTopicPushSeq` → `ON CONFLICT … n + 1`).

### Root cause (postgres-mem)

In-engine helper is effectively:

```js
function toI8(t, v) {
  return t === 'int8' ? v : BigInt(v);
}
function addI(t, a, b) {
  return checkIntRange(t, a + b);
}
```

If an **int8-typed** cell still holds a JS **number** (int4 literal / bind
stored into `bigint` without coercion), then `n + 1` becomes `number + bigint`
and V8 throws. Real Postgres promotes; JS does not.

**Engine fix:** always `BigInt(v)` for int8 values — never leave a raw `number`
in an int8 slot. Both sides of `addI` / `-` / `*` / `/` must be bigint when the
result type is int8.

App normalize (`@pkgs/sql-client` `normalizePgInt8*`) is **not** a substitute.

### Minimal repro — postgres-mem

Do **not** pass `{ int8: 'number' }`.

```js
import { Database } from '@crvouga/postgres-mem';

const db = new Database({ seed: 1 });
db.exec(`
  CREATE TABLE seq (
    id text PRIMARY KEY,
    n bigint
  )
`);

const upsert = `
  INSERT INTO seq (id, n) VALUES ($1, $2)
  ON CONFLICT (id) DO UPDATE
    SET n = seq.n + 1
  RETURNING n
`;

// First call: INSERT (may succeed).
db.query(upsert, ['t', 1]);

// Second call: ON CONFLICT path — product allocateTopicPushSeq shape.
// Expect: succeeds with n=2. Bug: TypeError mix BigInt / number inside addI.
db.query(upsert, ['t', 1]);
```

Also pin:

```js
// Number bind into bigint, then arithmetic.
db.exec(`CREATE TABLE t (id text PRIMARY KEY, n bigint)`);
db.query(`INSERT INTO t (id, n) VALUES ($1, $2)`, ['a', 1]);
db.query(`SELECT n + 1 AS x FROM t`);
db.query(`UPDATE t SET n = n + 1 RETURNING n`);
db.query(`SELECT * FROM t LIMIT $1`, [100]);
```

**Engine unit for `toI8`:** int8 slot + int4 literal must not throw; both
operands of `addI` must be bigint.

### Product-shaped SQL (gamezilla)

After `defineTable` migrate (`integer` → `bigint`), call twice:

```sql
INSERT INTO sync_engine_topic_seq (
  id, topic, n, created_at, updated_at, deleted_at
) VALUES ($1, $2, 1, $3, $3, NULL)
ON CONFLICT (id) DO UPDATE
  SET n = sync_engine_topic_seq.n + 1,
      updated_at = $3,
      deleted_at = NULL
RETURNING n;
```

Gamezilla pin: `allocateTopicPushSeq` twice on `SqlClientImplPostgresMem` after
`syncEngineServerSchema` (`pkgs/sync-engine`).

### Minimal repro — sqlite-mem

```js
import { Database } from '@crvouga/sqlite-mem';

const db = new Database();
db.exec(`CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)`);
db.exec(`INSERT INTO t (id, n) VALUES ('b', 9007199254740993)`);
const row = db.query(`SELECT n FROM t WHERE id = 'b'`)[0];
// row.n may be bigint outside MAX_SAFE_INTEGER
db.query(`SELECT n + 1 AS x FROM t WHERE id = 'b'`);
// JS after query: avoid Number(bigint) / bigint + number without coercion
```

### Browser / Metro

If Node `1.1.2` does not throw, still run the ON CONFLICT case under the
playground bundler (Metro). Int4 stored as number may only mix after migrate
binds or a different engine build.

### Related (already mitigated in gamezilla)

- **BUG-1** (wire): Hermes `Cannot convert BigInt to number` on returned int8 —
  fixed via `normalizePgInt8*` (`pkgs/sql-client/src/tests/bugs-found.md`).
- **BUG-2** (in-engine mix): this document + `bug-bigint-mix.pbt.test.ts`.
