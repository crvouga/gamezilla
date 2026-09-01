# Phase 0 findings — purity + assertions

## Purity violations found and fixed

| Violation | Property / exposure | Refactor |
| --- | --- | --- |
| `sortPlanActions` lacked name/table tie-break | `determinism.pbt` (equal priority deprecate/drop order) | Tie-break by table then name via `compareNames` |
| Bare `localeCompare()` in ingest/plan/consolidate | Same | `compareNames` byte-wise ASCII compare |
| Postgres introspect unordered | Port order nondeterminism | `ORDER BY` + `sortByName` on return |
| SQLite introspect unordered | Port order nondeterminism | `sortByName` on return |
| SimDb Map iteration for usage/meta | Insertion-order arrays | `sortByName` before return |
| Consolidation `skipped[]` Map-order | Budget skip order | Sort via `compareSkipped` |

No `Date.now` / `Math.random` / `process.env` / wall crypto in package (verified).

## Assertion gaps closed

| Invariant | Location |
| --- | --- |
| I1 owned-name on every plan action | `diffOwnedIndexes` post-sort loop + `assertIsOwnedName` |
| I1 negative space (no ix_/ux_) | Same loop |
| I3 usage-unchanged + window before drop | `pushDeprecateDropActions` asserts before emit |
| Kept candidates are owned | `consolidateCandidates` postcondition |

## Remaining known limitations (not purity bugs)

- SQLite `readIndexUsage` always returns 0 scans (observable behavior; usage-hold covered by SimDb + PG).
- Float improvement ratios in eval (stable for identical inputs).
