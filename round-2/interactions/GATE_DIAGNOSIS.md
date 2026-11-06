# Gate diagnosis

No tracked changes or verification reruns performed.

## Chart ownership

The recorded failure is `/more/troubleshooting` without a chart owner. A search of `specs/` and `docs/statecharts/` finds no Troubleshooting contract or declared ownership. `specs/product.machine.json:11303` owns `/more/sync` and `/more/server-status` in `Inspectors: Sync inspection`; its description explicitly says diagnostic controls and failure outcomes still need a complete observable contract. `docs/statecharts/INVENTORY.md:46` likewise identifies inspection scope without guessing missing behavior.

Assigning the new page to that state is plausible but not established by the existing specs, so no speculative metadata edit was made. The applicable limits are `specs/README.md` P2 (implementers never edit specs) and `.agents/skills/spec-upsert/SKILL.md` (never guess ownership; edit only feature/model/glossary/docs). The task allowed repair only if existing specs establish correct ownership; that condition was not met. This remains the same pre-existing full-gate blocker, not a new board failure.

## Ubuntu reference-authoring comparison

The retained failure log proves 558 of 559 selected checks passed. The only failing case is `screens-games-word-tiles-board--recall-and-restore`, light desktop 1440. It reached the screenshot assertion after successful story readiness, play, browser-error and axe checks, then differed by 43,547 pixels (4%). The log reports a stable captured screenshot, so this is not a browser timeout or accessibility failure.

Expected: `libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recall-and-restore-light-1440.png`.
Actual and diff are retained in the workflow browser diagnostics under `stories.checks.ts-screens--88b4e-call-and-restore-light-1440-chromium`.

Next action: retrieve the expected/actual/diff artifacts from run 42207319704, compare the concrete changed regions, and correct any authoring-versus-comparison nondeterminism before accepting references. The log alone does not establish whether focus, scrolling or a stateful layout causes the difference. Do not bulk-accept it. Round-two Word Tiles changes also require fresh final-candidate authoring and comparison.

## Artifact retrieval follow-up

Run 42207319704 confirms immutable source `90bfe38de0eb0853b9d98e2aec00e88cb8384606`. Full public logs saved as `ubuntu-full.log`. GitHub artifact API returns no artifacts, by repository design. The documented CI-bucket download was attempted through secrets-run; it failed because Infisical was unavailable, no local cache existed and `CI_ARTIFACTS_BUCKET` was not set. No credentials were requested or copied.

The log fallback decoded successfully but produced **zero bytes**. Source diagnosis establishes why: at the candidate, `storybook-baseline-patch.ts` filters only `:(glob)pkgs/*/src/**/baselines/chromium/**`. All game board references are under `libs/`, so the exported patch excludes them. This is an independent, concrete tooling defect. Authoring can succeed but still publish no usable board references. Fix the path selection to include both libs and pkgs (prefer the actual discovered baseline paths), add a literal regression with a libs-owned PNG, then re-author final candidate on Ubuntu. Current full log reports six uploaded diagnostic files, but their image contents were not retrievable without bucket credentials.

No expected/actual/diff comparison could be performed. The 4% mismatch's cause remains unproven; do not describe it as verified focus or scroll nondeterminism. The RecallAndRestore play awaits tentative/empty state after placement, recall, undo and redo, but does not explicitly settle focus/scroll geometry; this is only a candidate for further automated diagnosis after retrieving the artifacts.

## Authorized exporter repair

Changed only `scripts/storybook-baseline-patch.ts`, its direct `.test.ts`, and `goal/known-bugs/storybook-baseline-patch-omits-game-boards.json` under tools-harness. Both libs and pkgs baseline pathspecs now participate in new-file staging and binary diff export. The existing black-box patch reproduction test now pins the exact Word Tiles libs path alongside the existing pkgs path, covering additions/modifications/deletions and unrelated-file exclusion.

Red reproduction: libs fixture failed with "No valid patches in input" while pkgs passed. Green: exporter and byte-log tests 5/5, 53 assertions. Package tc + lint passed 2/2 after formatting. ci:goals remains blocked by other round-two workers' story-file regression registrations; the exporter record is not among findings. No baseline patch applied to the product checkout; no references accepted; no commit or push.

## Integration candidate eeeddf379 — full-gate rerun

`NODE_OPTIONS=--max-old-space-size=8192 TURBO_CONCURRENCY=1 bun verify` ran on pushed clean revision `eeeddf379b97be088e453cbbbf41887d91c33817`. It failed at the same `@libs/tools-harness-ts#ci:statecharts` route ownership check for `/more/troubleshooting`, after 43 successful tasks of 115 reached tasks (3 cached). No spec ownership or gate changed. `round-2/interactions/preexisting-statechart-proof.json` records identical route-table and product-machine blobs between the supplied candidate 55148defe and this integration commit. Full log: `round-2/interactions/verify-final.log`; diagnostics archive: `/var/folders/lf/7xlgzq1s749bccp0h53ykb940000gn/T/verify-run-XS1yr0/diagnostics.tar.gz`. This is a failed, incomplete full catalog, never a pass.

## Final selector candidate 69d07c220

Full `bun verify` reran on clean pushed `69d07c220beb5c0d1d985e0e142b66a52a7843e8`. The same ci:statecharts route-owner check failed after 16 successful tasks of 103 scheduled tasks (3 cached); setup generation separately passed 13/13. Source delta from eeeddf379 is only the Word Tiles story selector. Log: `round-2/interactions/verify-69d07c220.log`; diagnostics: `/var/folders/lf/7xlgzq1s749bccp0h53ykb940000gn/T/verify-run-w2SyP1/diagnostics.tar.gz`. No gate or spec changed.

## Reviewed-reference candidate 3ec6d124e

Full `bun verify` ran on final pushed `3ec6d124e0ad5487a06f0a3334aa09be0c7ce5dc`. Setup generation passed 13/13; the gate failed the same pre-existing `/more/troubleshooting` owner rule after 12 successful tasks of 13 (4 cached). The reference-only/documentation delta changes no product, story or test source. Log: `round-2/interactions/verify-3ec6d124e.log`; diagnostics: `/var/folders/lf/7xlgzq1s749bccp0h53ykb940000gn/T/verify-run-w9ahMb/diagnostics.tar.gz`. No speculative spec ownership or weakened gate.

Ubuntu run 42219355180 authored 610/610 and compared 608/610. The two new pixel-only mismatches are Word Tiles RecoverAndSubmit dark desktop and EnlargedBlank light desktop. 587 reviewed references were committed; those two and the prior unresolved RecallAndRestore light desktop were withheld. See `round-2/ubuntu/REVIEW.md` and `withheld.json`. The new documented artifact retrieval still failed due missing local secrets/cache and CI_ARTIFACTS_BUCKET, so no cause is claimed without actual/diff images.

## Final integration revision 7580af910

`bun verify` ran against the final source tree (committed as `7580af910457dd99962c231b75ced6da14e681b1` while verification ran in its isolated copy). Setup 13/13 passed; gate tasks 18/19 passed. The same pre-existing `/more/troubleshooting` missing chart owner stopped the catalog. Log: `interactions/verify-integration-final.log`; diagnostics: `/var/folders/lf/7xlgzq1s749bccp0h53ykb940000gn/T/verify-run-xek9e6/diagnostics.tar.gz`. No ownership/spec rule was changed.
