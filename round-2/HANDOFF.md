# Board integration handoff — round 2

Candidate: `7580af910457dd99962c231b75ced6da14e681b1`, branch `t3/game-board-ux-overhaul`, [PR 280](https://github.com/crvouga/gamezilla/pull/280). No ratings, manual product QA, merge, subagents or PR watch. Two new independent reviews are parent-owned and still pending.

## Changes integrated

- `eeeddf379`: removed the duplicate paired-panel/control identifier; preserved the switch identifier and pinned a literal failing example. Isolated synthetic pointer capture only in the Light Cycles story fixture and added trusted mouse/native capture verification. Corrected the Word Tiles local-list recovery explanation while retaining authoritative submission and real accepted-word assertions. Scoped score assertions to the player.
- `69d07c220`: made the next-turn assertion valid in both responsive layouts without weakening score, accepted tiles or post-acceptance controls.
- `3ec6d124e`: added 587 reviewed Ubuntu-authored reference PNGs and updated six readiness notes. Three disputed references remain absent. No rendered product/story/test source changed in that reference commit; [code equivalence](code-equivalence.json) lists every changed path.

- `7580af910`: pinned and fixed an unchanged-record refresh clearing Battleship aim; retained clearing on an explicit resync. Added chess `showGuidance` traceability and updated the exact coordinate assertion to the reviewed 14px. Focused lint/typecheck/test: 6/6. Hosted Battleship failure did not reproduce on the previous revision locally; the new regression independently demonstrates the reset defect.

## Verification

Focused integration lint/typecheck/test passed 15/15; final selector lint/typecheck passed 2/2. ci:goals passed, including on the final full-gate run. Known-bug registrations point to executable tests/checks, not stories.

Full `bun verify` on final head failed the pre-existing `ci:statecharts` rule: `/more/troubleshooting` has no declared chart owner. Setup generation passed 13/13; gate tasks passed 18/19. This is an incomplete, failed full catalog. No spec ownership was invented and no gate was weakened. The route and product-machine blobs are identical at the supplied, implementation and final heads. See [gate diagnosis](interactions/GATE_DIAGNOSIS.md), [provenance](interactions/preexisting-statechart-proof.json) and [final log](interactions/verify-integration-final.log).

The first complete repaired matrix on `69d07c220` reached pixels in 610/610 cases: readiness/play, browser-error and serious/critical axe stages passed. Pixel checks failed with 410 mismatches and 200 missing references. These results and the initial candidate's 14 functional failures remain preserved separately. No macOS references were accepted.

Final rebuilt-head matrix completed all 610 cases: readiness/play, browser-error and serious/critical axe checks passed 610/610. Pixels: 1 passed, 606 mismatches, 3 missing withheld references. No macOS acceptance. The static build contains 150 stories and SHA-256 `f60895dc5060db627511fb6fece2ed11647cd5ed8a7c5fb55fdd163199506f70`. [Final classification](interactions/final-head/browser-classification.json) separates pixels from play/assertion failures.

Hosted [Verify PR 42227842833](https://github.com/crvouga/gamezilla/actions/runs/42227842833) is green on `7580af910`: all four shards and `verify:end` passed. This safety subset does not make the broader failed local catalog green.

Earlier Ubuntu [run 42219355180](https://github.com/crvouga/gamezilla/actions/runs/42219355180) authored 610/610 and compared 608/610. All failures were at pixels. The complete public log exported 590 changed references from libs and pkgs. All 59 contact sheets were inspected; 587 intended, comparison-passing references were applied byte-for-byte. Ten selected references were unchanged. [Selection review](ubuntu/REVIEW.md), [accepted references](ubuntu/accepted.json), [withheld references](ubuntu/withheld.json).

Final Ubuntu [run 42227860547](https://github.com/crvouga/gamezilla/actions/runs/42227860547), on the final candidate, authored 610/610 and compared 605/610. Five pixel-only failures: RecallAndRestore light desktop (46,084 pixels), RecoverAndSubmit dark desktop (8,403), AcceptedExchange dark phone (39,758), and EnlargedBlank light/dark desktop (masked counts `***2353`/`***2369`). No play/axe failures. The five-image exported patch was decoded, all images reviewed, and entirely withheld. AcceptedExchange/AcceptedPass light phone also changed scroll offsets without a Word Tiles source change; their passing comparison does not explain authoring drift. Two newly failing references already exist from the previous passing selection and are now disputed. [Final review](ubuntu/final-run/REVIEW.md), [failures](ubuntu/final-run/failed-comparisons.json), [patch inventory](ubuntu/final-run/patch-inventory.json).

Withheld desktop 1440 references:

- Word Tiles match `recover-and-submit`, dark: 8,403 differing pixels.
- Word Tiles puzzle `enlarged-blank`, light: the public log reports `***2353` differing pixels (ratio 0.02); the exact count is masked.
- Word Tiles match `recall-and-restore`, light: current comparison passed, but the prior 43,547-pixel variance remains unexplained.

The documented artifact download was retried for this run and failed: Infisical unavailable, no local cache, CI_ARTIFACTS_BUCKET unset. CI uploaded ten diagnostic files. Authored expected PNGs are recovered; failed actual/diff PNGs remain inaccessible locally. Scroll position is observable in post-action images but is not claimed as the cause. No unexplained variance was accepted.

## Evidence

The final package contains the exhaustive 150-story inventory (144 board stories across 14 families and six shared-component stories), 600 PNGs in both themes at phone 390×844 and desktop 1440×900, 600 pairs against round 1, and 38 checkpoint-paced WebM recordings for 19 meaningful journeys. Canonical tests use desktop 1440×844. Seventy-two images across 18 newly captured stories are explicitly absent-before; they are not all newly created product stories.

[Gallery](GALLERY.md), [journey map and limits](journeys/mapping.json), [video audit](journeys/STATUS.md), [manifest and hashes](manifest.json). The videos use production-rule Storybook fixtures and native assertion checkpoints; recorder-only pauses do not change product clocks. They do not establish live transport or persisted recovery. Synthetic-touch and trusted-mouse distinctions are explicit in the journey map. Post-action frames preserve the automated journey's scroll position.

Round-1 evidence commit `40b34146d50454f12bf290d19611e6884a4c65de` remains immutable. The earlier round-2 media and all failed diagnostic runs remain locally preserved under `pre-reference-media/`, `pre-integration-media/` and `interactions/`. Large raw logs and diagnostic trees are retained locally; the publication includes compact reports, reference patch and review images.

## Remaining work outside this completed evidence pass

Retrieve the exact Ubuntu expected/actual/diff artifacts and diagnose all final comparison failures and unexplained authoring drift before accepting changes. The final-run artifact download also failed with missing bucket credentials. Resolve public-route ownership through the repository's authorized spec workflow. Start two new independent reviews against this candidate and manifest; no prior review or score is carried forward. A human owns merging.

Publication commit, evidence code and comment URLs are recorded in the local `publication.json`; PR comments link immutable evidence commit paths. All final media and hash audits completed. Two new independent reviews remain pending.
