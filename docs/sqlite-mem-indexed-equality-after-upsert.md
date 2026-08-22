# Bug: sqlite-mem misses rows on indexed `col = ?` after upsert

**Engines:** `@crvouga/sqlite-mem` (confirmed). `@crvouga/postgres-mem` not implicated in this failure mode (server wrote the row correctly); included below only as a parallel checklist if secondary-index maintenance is shared.

**Seen in:** gamezilla sim playground (`bun run dev` → `@sim/console`), friend-request → Bob notifications inbox empty while the row is visible in the client DB inspector.

**Versions (gamezilla lockfile at discovery):**

- `@crvouga/sqlite-mem@1.2.0`
- `@crvouga/postgres-mem@1.0.1`

**Status (sim default):** playground / `@sim/test` default fabric is **real SQLite** (`SIM_SQL_BACKEND=real`), so the product inbox no longer depends on this bug. The `substr` workaround was **removed**. Keep this doc for upstream sqlite-mem fix when using `SIM_SQL_BACKEND=mem`.

---

## Symptom

After an `INSERT … ON CONFLICT (id) DO UPDATE` (sync-engine merge upsert) into a **STRICT** table that has a **secondary index on `user_id`**:

| Query | Result (buggy) |
| --- | --- |
| `SELECT COUNT(*) FROM notifications` | `1` (row exists) |
| `SELECT * FROM notifications` / DB inspector | Row visible |
| `SELECT user_id = ? AS ok FROM notifications` | `ok = 1` |
| `SELECT SUM(CASE WHEN user_id = ? AND active = 1 THEN 1 ELSE 0 END) FROM notifications` | `1` |
| `SELECT id FROM notifications WHERE archived_at IS NULL` | `1` row |
| `SELECT id FROM notifications WHERE active = 1` | `1` row |
| **`SELECT id FROM notifications WHERE user_id = ?`** | **`0` rows** |
| **`SELECT id FROM notifications WHERE user_id = ? AND active = 1`** | **`0` rows** |
| `SELECT id FROM notifications WHERE substr(user_id, 1) = ? AND active = 1` | `1` row |

Bound `?` and stored `user_id` were **byte-identical** (`length` 36, same `hex(...)`).

Interpretation: table heap / expression evaluation sees the row; **indexed equality on `user_id` in `WHERE` does not**. `substr(user_id, 1)` forces a path that does not use the broken index entry.

This is **not** an `IS NULL` / `IS TRUE` issue (those predicates worked in both SELECT-list and unbound `WHERE archived_at IS NULL`).

---

## Product path that triggered it

1. Alice client: `sendFriendRequest` mutation → server outbox `FriendRequestSent`.
2. Server drain: notification row for Bob (`active = true`, `archived_at` / `dismissed_at` null).
3. `notifyChannels` on `user:<bobId>` with `tables: ['notifications']`.
4. Bob client: push wake → `notificationsActive` snapshot → `applyFullMerge` upserts into local sqlite-mem.
5. Bob UI: `inboxListSql` historically used `WHERE user_id = ${userId} AND active IS TRUE AND …` → **0 rows** despite the row in the DB table view.

Merge upsert shape (simplified): intersect columns, then

```sql
INSERT INTO notifications (id, user_id, …, active, …)
VALUES (?, ?, …, 1, …)
ON CONFLICT (id) DO UPDATE SET
  user_id = excluded.user_id,
  active = excluded.active,
  …;
```

Client table (from `defineTable` + managed columns) is roughly:

```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  user_id TEXT,
  source_namespace TEXT,
  source_type TEXT,
  source_id TEXT,
  category TEXT,
  priority INTEGER,
  -- … other TEXT / INTEGER cols …
  archived_at TEXT,
  dismissed_at TEXT,
  active INTEGER
) STRICT;

CREATE INDEX … ON notifications (user_id);
CREATE INDEX … ON notifications (user_id, active, archived_at, priority, created_at);
CREATE UNIQUE INDEX … ON notifications (user_id, source_namespace, source_type, source_id);
```

Boolean `active` is stored as integer `0`/`1` on the wire into sqlite-mem.

---

## Minimal reproduction (sqlite-mem)

Goal: after upsert, `WHERE user_id = ?` returns 0 while a table scan / `substr` / `CASE` still sees the row.

> **Note:** A reduced Node repro with only a single `user_id` index sometimes **did not** fail under bun during investigation. Prefer matching product shape: **STRICT**, **PK upsert**, **secondary + composite indexes**, and if needed the **browser** sqlite-mem build (playground). If the minimal script below passes, escalate to the “fuller” script and/or run inside the same bundler as the web sim.

### Script A — closest to product

```js
import { Database } from '@crvouga/sqlite-mem';

const userId = 'e9547fd5-9c96-4cb4-97be-92fc6b2a4441';
const db = new Database({ seed: 1 });

db.exec(`
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    created_at TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    user_id TEXT,
    source_namespace TEXT,
    source_type TEXT,
    source_id TEXT,
    category TEXT,
    priority INTEGER,
    title TEXT,
    archived_at TEXT,
    dismissed_at TEXT,
    active INTEGER
  ) STRICT;
`);
db.exec(`CREATE INDEX notifications_user_id ON notifications (user_id);`);
db.exec(
  `CREATE INDEX notifications_inbox ON notifications (user_id, active, archived_at, priority, created_at);`
);
db.exec(
  `CREATE UNIQUE INDEX notifications_source ON notifications (user_id, source_namespace, source_type, source_id);`
);

const id = `friends:friend-request:req1:${userId}`;
const created = '2026-08-21 20:37:34.214+00';

db.prepare(
  `
  INSERT INTO notifications (
    id, created_at, updated_at, deleted_at, user_id,
    source_namespace, source_type, source_id, category, priority,
    title, archived_at, dismissed_at, active
  ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
  ON CONFLICT (id) DO UPDATE SET
    user_id = excluded.user_id,
    active = excluded.active,
    archived_at = excluded.archived_at,
    dismissed_at = excluded.dismissed_at,
    category = excluded.category,
    priority = excluded.priority,
    title = excluded.title,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at
`
).run(
  id,
  created,
  created,
  userId,
  'friends',
  'friend-request',
  'req1',
  'action_required',
  10,
  '@alice sent you a friend request',
  1
);

// Optional: upsert again (merge can rewrite the same snapshot row).
db.prepare(
  `
  INSERT INTO notifications (
    id, created_at, updated_at, deleted_at, user_id,
    source_namespace, source_type, source_id, category, priority,
    title, archived_at, dismissed_at, active
  ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
  ON CONFLICT (id) DO UPDATE SET
    user_id = excluded.user_id,
    active = excluded.active
`
).run(
  id,
  created,
  created,
  userId,
  'friends',
  'friend-request',
  'req1',
  'action_required',
  10,
  '@alice sent you a friend request',
  1
);

const count = db.query('SELECT COUNT(*) AS c FROM notifications');
const onlyUser = db.query('SELECT id FROM notifications WHERE user_id = ?', [
  userId,
]);
const caseMatched = db.query(
  `SELECT SUM(CASE WHEN user_id = ? AND active = 1 THEN 1 ELSE 0 END) AS m
     FROM notifications`,
  [userId]
);
const substrOk = db.query(
  'SELECT id FROM notifications WHERE substr(user_id, 1) = ? AND active = 1',
  [userId]
);
const hex = db.query(
  `SELECT length(user_id) AS ulen, hex(user_id) AS uhex,
          length(?) AS alen, hex(?) AS ahex
     FROM notifications`,
  [userId, userId]
);

console.log({
  count,
  onlyUserLen: onlyUser.length, // buggy: 0
  caseMatched, // expect [{ m: 1 }]
  substrOkLen: substrOk.length, // expect 1
  hex,
});

if (count[0]?.c === 1 && onlyUser.length === 0 && substrOk.length === 1) {
  console.error('REPRODUCED: indexed WHERE user_id = ? missed the row');
  process.exit(1);
}
console.log('Did not reproduce with this script (try Script B / browser).');
```

### Script B — force index use / isolate `reindexEquality`

If Script A passes, try:

1. Insert **without** the `user_id` index, confirm `WHERE user_id = ?` works.
2. Create the index **after** insert; confirm lookup works.
3. Create the index **before** insert; confirm lookup fails (points at insert/upsert index maintenance).
4. `INSERT` then `UPDATE notifications SET user_id = user_id` / change `active`; see if `reindexEquality` paths diverge.
5. Run `REINDEX` after upsert and check whether `WHERE user_id = ?` recovers (engine already parses `REINDEX`).

Also compare `db.query(sql, [userId])` vs prepared `stmt.all(userId)` bind spreading — gamezilla’s `SqlClientImplSqliteMem` uses `db.query(sqlText, bindsArray)` for queries.

### In-repo playground repro (always reproduced)

1. `bun run dev` → sim console playground, Alice + Bob signed in.
2. Alice: Add Friend → Bob.
3. Bob: open DB inspector → `notifications` has the friend-request row.
4. Bob: Notifications UI empty when inbox SQL uses bare `user_id = ?`.
5. Same session probes (historical): `onlyUser: 0`, `caseMatched: 1`, `substrUid: 1`, identical `hex(user_id)`.

---

## postgres-mem checklist (not the same bug)

This incident’s broken reads were on the **client** sqlite-mem DB. Server postgres-mem:

- Created the notification (`active` true).
- Drained outbox and `notifyChannels` with `tables: ['notifications']`.
- Served a correct snapshot (`notifRows: 1`) for merge.

Still worth a **parity check** in postgres-mem if you share index-maintenance code or plan similar secondary indexes:

1. Create a table with a secondary btree on `user_id`.
2. `INSERT … ON CONFLICT DO UPDATE` a row.
3. Assert `SELECT … WHERE user_id = $1` returns the row.
4. Assert `EXPLAIN` (if available) still uses a sane plan after upsert.

No product failure was observed on that path for this bug.

---

## Expected fix (engine)

- Secondary indexes must stay consistent across `INSERT`, `UPDATE`, and `INSERT … ON CONFLICT DO UPDATE` (including when `user_id` / indexed columns are rewritten to the same values).
- Indexed `WHERE user_id = ?` must agree with expression evaluation / table scans for the same binds.
- Add a regression test: STRICT table + index on TEXT PK-adjacent column + upsert + equality lookup.
- Optional: ensure `REINDEX` rebuilds from heap and recovers if maintenance was skipped.

---

## Related product notes

- Sync merge: `pkgs/sync-engine/src/client/merge.ts` (`upsertRowIntersect`).
- Client inbox (workaround): `libs/notifications/src/public/notifications-queries.ts`.
- Sim client engine: `pkgs/sql-client/src/sqlite/impl-sqlite-mem.ts` (`adaptSql` rewrites `IS TRUE` → `= 1`; unrelated to this miss).
- Wishlist: `docs/sim-mem-engine-wishlist.md` (clone/COW etc.; this bug is correctness, not perf).
