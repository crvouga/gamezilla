# Bugs found during testing overhaul

## BUG-1: unique `autoidx_*` imposter crashed planner (fixed)

- **Property / seed:** `ownership.pbt` / `genDbState({ imposter: true })`
- **Symptom:** `pushRepairActions` asserted `owned index must never be unique`
  when an external unique index matched the owned name regex.
- **Fix:** unique / PK names are reserved: excluded from `ownedActual`, skipped
  on create, and asserted absent from planned actions.
- **Pin:** `src/tests/pbt/bug-unique-imposter.pbt.test.ts` (expects no crash).

## BUG-2: stale fingerprint crashed ingest (fixed)

- **Property / seed:** `skipped-completeness.pbt` / `indexes-world.system.pbt`
- **Symptom:** `validateStatement` asserted `fingerprint must be sha256 hex`
  instead of using the `fingerprint_divergence` skip reason.
- **Fix:** ingest skips short or mismatched fingerprints; other statements plan.
- **Pin:** `src/tests/unit/ingest.test.ts` (`bad fingerprint is skipped`).
