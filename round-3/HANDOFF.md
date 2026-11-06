# Board round 3 integration handoff

Candidate: `897a7562d2fee9d4cec187281ac84119de322c05`. Immutable publication and evidence code are recorded in manifest.json and publication.json. This is automated Storybook evidence for all 14 boards, not a design rating or live-network verification. The parent must commission two new independent Codex design and UX reviews after publication; no prior score carries forward.

## Results

The final canonical matrix has 629 cases: 620 visual cases passed native readiness, play, page-error and serious/critical axe checks; eight controlled font checks and the instrumented chess regression passed. All 620 macOS pixel comparisons failed; none were accepted. The three phone font cases retain identical geometry across controlled loading schedules and across runs, with byte-identical paired PNGs. This does not retroactively establish the cause of the historical Ubuntu phone drift.

Owning checks passed 23/23 after Storybook authoring repairs and 12/12 after the hosted integration repairs, including the real-board Hill party journey. ci:goals passed. Full bun verify failed the unchanged /more/troubleshooting statechart-owner rule: setup 13/13, catalog 19 successful tasks and 88 reported total when stopped. Unexecuted tasks are not passing. Storybook coverage remains 254 violations: seven selected board references pending Ubuntu acceptance, other missing/orphan references, and one unrelated generic puzzle-screen metadata issue.

Hosted safety is separately red. Verify PR run 42255284297 fails the offline Numberlink authoring journey while opening the library after space navigation, before board interaction. Its cause is not established here; it is not labeled flaky or proven pre-existing, and was not retried. See interactions/HOSTED_SAFETY.md and pr-final-status.json.

## Integration repairs

Literal checks cover full chess ranks before input, full Hearts hand and trick context, bounded Battleship placement and correction, Quoridor proposal/cancel/commit/pass, and Word Tiles exchange plus sticky coordinate focus clearance. Integration repaired the Battleship gutter budget and enlarged-container shrinkage, chess square selector and pointer host, nine generated story-manifest errors, and excessive chess geometry instrumentation. Every boundary comparison remains; violations are collected into one assertion for efficient native replay.

Hosted logs additionally exposed missing fitSquare contract-proof metadata and shared Quoridor automation stopping at wall preview. The former is registered; the latter now commits walls and directly invokes the sole forced-pass control. Literal regressions and per-bug records are committed. The existing real-board party journey failed before and passed after the automation fix. No spec text, timeout, tolerance or gate was weakened.

## Evidence

The inventory derives from the final static build index and preserves every round-2 story ID. Screenshots cover 151 stories at 390×844 and 1440×900, both themes; canonical comparisons use 390×844 and 1440×844. All 600 before images come from immutable round-2 publication 245f924e5689c5f97f29932a115ad1890859867c. Four new coordinate-story states explicitly lack before images.

The final video selection contains 26 interactive stories, both viewports. Native replay retains assertions and checkpoint outcomes, with recorder-only pacing. WordListUnavailable is static and remains in screenshots/browser checks; ReachTarget already proves retry with draft retention. The failed attempt to record that static story is preserved and explained in journeys/RECORDING_SELECTION.md. Per-board intrinsic tasks and unproven transport/persistence limits are in journeys/mapping.json.

## Outstanding Ubuntu decision

Final-head Ubuntu run: https://github.com/crvouga/gamezilla/actions/runs/42255354537 . Its current author/compare status and accepted-reference count are in ubuntu/verdict.json. The superseded 4c0543986 run authored 629 passing cases and emitted 366 PNG changes; its comparison was cancelled after hosted defects required a new candidate. That decoded patch and inventory are diagnostic only, with zero acceptance.

When the final external run completes, retrieve public logs, decode the encoded PNG patch with libs/tools-harness-ts/scripts/storybook-baseline-patch.ts, inspect actual intended changes with review-ubuntu.py, and assess author/compare diagnostics. Withhold unexplained variance; do not accept an old phone shift simply because one comparison passes. Any reference commit requires refreshed exact-head verification and media before independent review.

No manual QA, self-rating, merge or child PR watch was performed. Product media stays off the feature branch. Prior evidence is preserved.
