# SQLite everywhere vs Postgres server

**Decision (2026-08-19):** SQLite on the client; PostgreSQL on the server. Do not
move production to Turso. Do not write a postgres-mem emulator.

**One sentence:** Keep Postgres as the server because it is already the
irreplaceable replica, DST’s job is the sync protocol not MVCC, and Turso is an
unacceptable vendor for that replica.

Stop relitigating. Reopen only under the triggers below.

---

## What we run today

This was not a greenfield engine pick. Option B is already in tree:

- Client / Expo: SQLite (`sqlite-mem`, bun/better-sqlite, OPFS). No production
  Postgres on Hermes or iOS.
- Production: Postgres (Neon-shaped). Tests/CI may boot `@pkgs/postgres-embedded`.
- Portable SQL: `assertAgnosticSql` / `ci:no-vendor-sql` plus
  `@pkgs/postgres-sqlite-compat` (JSON1-shaped APIs on Postgres).
- Dual schema: `defineTable` → SQLite + Postgres migrations.
- Daily `bun dev` / DST default / playground API: **SQLite** (`migrateSimSqlite`,
  sqlite-mem). Representativeness of Postgres is contract matrices +
  `openSim` fidelity `max`, not a second stack for clicking.
- Cross-user friend search: REST `POST /friends/search` with portable prefix
  `LIKE` on username — not FTS5 vs `tsvector` query-driven sync.

sqlite-mem stays the client / playground / sim-**client** engine. That asset
does not require Turso in production.

---

## Verdict

| Option | Status |
| --- | --- |
| **B — SQLite client + Postgres server** | **Chosen.** Keep Neon (or interchangeable Postgres). |
| A — SQLite everywhere (Turso / libSQL) | Rejected for the source of truth. |
| Write postgres-mem | Rejected. Project-killing detour; use PGlite if closing the DST gap. |

Workload is local-first social CRUD; multiplayer game state is a separate
realtime path. Server reads are not the bottleneck. Scale at 1M DAU does not
force an engine. The binding constraint is who holds the irreplaceable replica
and what we already operate.

Cost is not decision-relevant: both paths are affordable at realistic tiers and
converge on self-hosting at extremes.

---

## Conditions (do these; then stop)

1. Treat portable SQL + `postgres-sqlite-compat` as the product, not a temporary
   hack.
2. Write down the DST gap: default sim/playground server is SQLite; prod is
   Postgres. Close it with **contract matrices** and `openSim({ fidelity: 'max' })`
   (PGlite / embedded Postgres), not postgres-mem or pg-mem as the fidelity story.
3. Keep search as REST / portable `LIKE` (or server-computed match sets). Do not
   run FTS5 SQL as the canonical sync query on both engines.
4. Keep sqlite-mem for clients. Do not “complete the vision” by putting Turso in
   prod.

---

## Why the LLM split was not information

SQLite-everywhere chats (Grok, Claude, Gemini) optimized for engine purity and
DST capturing single-writer SQLite. Postgres chats (ChatGPT, DeepSeek)
optimized for source-of-truth and vendor interchange. Both arguments are real;
the repo weights them.

What the SQLite-everywhere case overweighted:

- **DST fidelity ceiling.** True as research (Postgres MVCC is not fully
  reproducible in a deterministic single-process sim). Weak as a decision here:
  DST already uses a SQLite server; the bugs DST exists for are mutation replay,
  merge, tombstones, retries, partitions, clocks — sync protocol, not
  `SERIALIZABLE` anomalies. Turso-with-replicas also diverges from vanilla
  sqlite-mem.
- **Search parity.** Hypothetical FTS5 vs `tsvector`. Actual search is REST
  prefix `LIKE`. Tokenizer disagreement is a product bug only if both engines
  run the same FTS SQL as canonical. Engineer around later with server IDs or a
  shared tokenizer — do not let it pick the SoT engine.
- **Turso mitigation.** Litestream insures bytes on disk, not the serving layer
  (HA, failover, cloud API, company trajectory). Self-host `sqld` is a worse
  Neon after throwing away interchange.

What the Postgres case correctly valued (and the SQLite case undervalued):

- Client DBs are expendable (resync); the server DB is not.
- Dual-engine tax is **already paid**. Switching to Turso is a production
  migration, not a starting architecture.
- Innovation budget is already on sqlite-mem, the sync engine, and DST. A third
  database company under the SoT is the wrong spend.

**postgres-mem:** sqlite-mem worked because SQLite is a small single-writer
dialect, differentially tested against 3.51. Postgres MVCC/catalogs/types are
research. PGlite is already in-process real Postgres. Do not spend months on a
second in-memory engine.

**Oscillation:** The Postgres pull without a “new” technical argument was still
technical: refuse Turso as SoT, plus sunk dual-stack. The SQLite pull was DST
and sqlite-mem feeling wasted if prod is “the other engine.” They are not
wasted; they own the client half, which Expo forces. “Decide and stop
relitigating” was the right framing.

---

## Reopen SQLite-everywhere only if

- Architecture changes to compute-next-to-a-SQLite-file (per-tenant PDS, DO/D1,
  Fly+volume) — not merely “same dialect.”
- A **user-visible** dialect/semantics bug in prod that DST cannot express, and
  PGlite-in-sim did not catch it either.
- Managed Postgres becomes inoperable **and** a boring multi-vendor SQLite
  serving layer exists (not a single startup).

Do **not** reopen for: cost at 30M DAU, PostGIS/pgvector FOMO, or another LLM
chat.

---

## Historical brief (context for the decision)

**Application.** Local-first: every client holds SQLite; UI reads local;
mutations apply locally then sync. Raw SQL via `SqlClient`. Soft-deletes /
tombstones. DST models client + server nodes, retries, network failures.

**Scale napkin (not decision-relevant).** ~50 domain mutations/user/day ×2 sync
amplification. 1M DAU ≈ 1–3K writes/sec peak — one modest primary. 30M DAU would
need batching/splitting on either engine.

**Option A (rejected).** sqlite-mem client+sim; Turso Cloud (battle-tested
libSQL, not the pre-1.0 Rust rewrite); pinned-region primary + replicas;
queue-and-batch; Litestream/self-host drill; portable SQL + Postgres corpus as
escape hatch.

**Option B (chosen).** SQLite client; managed Postgres. DST default stays SQLite;
representativeness is contract matrices + `fidelity: 'max'` (embedded Postgres /
PGlite), not pg-mem or postgres-mem.

---

## Sources (prior LLM opinions)

SQLite everywhere:

- [Grok](https://grok.com/c/66641dc8-a212-4d5f-a533-6408692edd6a?rid=dba030f0-59a8-42a1-b9a3-56f34030c7b5)
- [Claude](https://claude.ai/chat/1f8878b8-2096-4e85-9f1a-5cecf9e3ec22)
- [Gemini](https://gemini.google.com/app/7423f25531b35141)

Postgres server:

- [ChatGPT](https://chatgpt.com/c/6a85eece-14d4-83e8-abe9-344eba6d949a)
- [DeepSeek](https://chat.deepseek.com/a/chat/s/f2cfa84a-455c-4d20-abf5-865a9698f872)
