# Round-four integration handoff

Candidate: `8a3538fca4c9d23ff931be3dfa85b1080ebc0041` on `t3/game-board-ux-overhaul`, [PR 280](https://github.com/crvouga/gamezilla/pull/280). Two commits integrate the worker changes and the accessible-name correction. No specifications or reference images were accepted into this candidate. Prior rounds remain intact.

## Integration

Reviewed all worker handoffs and the shared diff. Updated the exact custom-game, Quoridor, Word Tiles and Hearts self-service readiness rows. Cache synchronization and Lingui extraction/compilation completed; only the required source PO catalog is committed. Generated contract metadata confirms the two new composition slices and required puzzle library callback. The real-board Hill party consumer passes its package tests; Word Tiles consumers retain their action identifiers with controls now local to the board.

The native suite exposed clipped enlarged Word Tiles focus and out-of-viewport Hill/Classic controls. Product fixes scroll the focused square into view and bound Quoridor board size while preserving full-size precise-coordinate controls. Each literal failure has a native regression and its own known-bug record. Source review found compact Quoridor visible labels missing from their accessible names; a red DOM regression now passes with Horizontal/Vertical labels. Six worker bug records were corrected to point to executable literal native tests. Assertions were preserved; Battleship bottom alignment was strengthened to exact equality. No retries, skips, tolerance increases or spec edits.

## Verification

Final eight-package lint/typecheck/test aggregate: **24/24 passed** (24 cache hits). `ci:goals` passed. The final static Storybook build succeeded with Node 8 GiB and Turbo concurrency 1. Final build SHA-256: `19bf9503f51db3b7fa4952304f90191d78e691d001d8070f93957456403da2bd`. Generated metadata is bound in `contract-summary.json` and `contract-metadata.json`.

Full `bun verify` exited 1: setup 13/13 succeeded; catalog 16 successful / 19 reported before stopping at `@libs/tools-harness-ts#ci:statecharts`: `/more/troubleshooting: no chart state owns the public route from libs/app-root-client-ts/src/route-table.ts`. This is the specified out-of-scope ownership gap. The rest of the catalog is not claimed passed. Exact outcomes and logs are in `interactions/command-outcomes.json` and `interactions/GATE_STATUS.md`.

Initial native matrix: 655 cases, 19 functional failures, 627 pixel failures and 9 passes. First geometry repair: 101 cases, 5 functional failures. Final focused repair: 101 cases, zero functional failures, 101 pixel failures. These superseded attempts are preserved separately. Exact-candidate results appear below after completion; no macOS references are accepted.

## Scope and evidence limits

The manifest and `journeys/mapping.json` bind all fourteen board surfaces and enumerate remaining gaps per board. Storybook fixtures do not establish live transport or persistence. Numberlink pointer recovery uses synthetic touch with pointer capture stubbed. Word-list retry is synchronous. Hearts proves pass and first trick, not a full match. Pong/Light Cycles exercise controlled rule fixtures, not real network recovery. Recordings are automated assertion replays with recorder-only pacing, not natural timing or manual QA. No reviewer ratings are assigned; the parent must commission two new independent reviewers on the immutable candidate.

The earlier hosted Numberlink failure is separately diagnosed at `../hosted-numberlink-repair/DIAGNOSIS.md`: an eight-second SQLite connection deadline falls back to empty disposable memory before board presentation. The underlying worker stall remains unproven. No outside-scope repair or rerun was used to hide it.

## Reference policy

Round-three Ubuntu run 42255354537 succeeded on 897a756. Its public encoded patch was decoded and inspected under `ubuntu/prior-round3`; none was applied blindly to changed round-four layouts. Round-four canonical Ubuntu author/compare run is https://github.com/crvouga/gamezilla/actions/runs/42271653228 on the exact candidate. Public log export is the available artifact route; bucket credentials are unavailable and were not copied. Acceptance requires intentional reviewed changes and a passing same-head comparison. See `ubuntu/verdict.json` for the final observed status.

## Exact-candidate native matrix

657 cases completed: **648/648 native readiness/play, browser-error and serious/critical axe stages passed**, eight font checks passed and one instrumented chess geometry regression passed. All 648 pixel comparisons failed against existing references. The command exits 1; this is not an overall visual-suite pass. No macOS images were accepted. See `interactions/runtime-verdict.json` and the raw classified report. Phone 390×844 and desktop 1440×844, both themes, include all fourteen board families, every state and the new placement-layout/workbench references.

## Hosted safety snapshot

[Verify PR 42271608909](https://github.com/crvouga/gamezilla/actions/runs/42271608909) succeeded on the exact candidate: start, all seven shards, and `verify:end` are green. GitGuardian is green. Independent round-four reviews have not started. This hosted safety subset does not supersede the failed local full catalog. No PR watch or merge was started.

Exact-candidate Storybook coverage exited 1: 970 exports, 258 story files, 270 violations. These include missing/unaccepted references and pre-existing orphan references/component metadata. Sixteen new references remain unaccepted. The new helper preview-import leak was fixed; no blanket coverage success is claimed. See `interactions/coverage-candidate.log`.

## Ubuntu pending handoff

Final observed snapshot: round-four authoring and reference collection succeeded on the exact candidate; same-head comparison remains **in progress**. No polling loop/watch is running. Zero references are accepted. The parent must retrieve the completed public log, decode its exporter patch, inspect intentional changes, and preserve unexplained differences before accepting any refs. This snapshot is timestamped in `ubuntu/verdict.json`; it is not an acceptance claim. A reference commit would change head and require refreshed binding verification.

## Published evidence scope

624 current screenshots and 624 labeled before/after pairs cover all 156 selected stories at phone 390×844 and desktop 1440×900, both themes. The 604 before images match the immutable round-three manifest; 20 images for five new stories are explicitly absent-before. All 58 recordings (29 journeys × two viewports, light theme) completed native replay without checkpoint failures, each with at least two distinct frames. Pre-input checkpoints retain geometry context; unchanged numeric geometry checks still execute and reuse their preceding frame. All media hashes are in `manifest.json`; recording durations/checkpoints are in `journeys/recordings/video-manifest.json`.

Media commit and PR comment links are recorded in the publication receipt after the immutable media commit is created. The parent should use that receipt and commission two new independent reviewers; no ratings, acceptance, merge or watch were performed here.
