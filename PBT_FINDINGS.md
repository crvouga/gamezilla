# PBT Findings

No production bugs were surfaced by the property suites added in this overhaul.

All 31 property tests across 13 files passed under the pinned seed policy
(`FC_SEED=424242` by default).

If a future property fails:

1. Capture `seed`, `path`, and (for `fc.commands`) `replayPath` from the failure.
2. Pin the shrunk counterexample via `examples` on `assertProperty`.
3. Add a row here with the minimal case — **do not silently patch production**.

| Date | Property | Seed | Path | Minimal counterexample | Status |
|------|----------|------|------|------------------------|--------|
| — | — | — | — | — | none yet |
