# Rules migration findings

Improvements deferred during the isomorphic-write → isomorphic-rules big-bang (bug-for-bug port). Do not treat these as regressions of the migration itself.

## Trust / product

1. **Chess puzzle ratings are client-writable.** `chess_puzzle_profiles` / interaction rating columns upload from the client today. Consider server-owned rating computation later; keep applyBatch allowing those columns until then.
2. **`endIfLastSeat` is not SQL-provable.** Leave-space trusts a client-observed seat emptiness flag. Room/seat authority should eventually drive end-from-last-seat without a client boolean.
3. **Join ACL check uses `accountId` vs `memberId`.** `isSpaceUserInStore(..., accountId)` may not match rows keyed by member id — preserved bug-for-bug; fix carefully with a dual-key lookup or migrate ids.
4. **Friends upload is stricter than the old party-only row-bindings.** Rules now encode write-package checks (blocked, cooldown, etc.) on the server. Intentional isomorphic closure; watch for false 409s from partial local state.
5. **entity_store `todo-list` / `todo-list-item` remain open** (no ownership). Confirm intentional before production exposure.
6. **Username uniqueness stays REST-only** (`PUT /profile/username`, `POST /profile/ensure`). Do not make username client-uploadable.

## Engineering

7. **Dual-dialect contract suite** should grow to cover every rule query via `prepare`/`assertQuery` on seeded SQLite + Postgres (started; expand per domain).
8. **Rejection metrics** are in-process counters + logs (`upload-rejection-metrics.ts`). Wire to the real observability backend when available; tag by failure code + app version.
9. **Constructive helpers** (streak, cooldown, host actor) should stay next to the assertive rules that use them so write sites cannot drift. Domain rules now live under `libs/<feature>/src/shared/rules/`; spaces host/join helpers use the canonical `@libs/spaces` participation policy (pkgs duplicates removed).
10. **Profile local username fill** still writes server-owned columns locally; upload strips them. Document for future agents so they do not “fix” that away without a sync story.
