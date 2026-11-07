# Round-seven integrated evidence handoff

Source: `b606946642616ea53bbf11e8b4fb23e08fb55c5f`. Media: `f05f61a51cd6961c7e5ae1883d3c9a1e6f384b0d`. Evidence code: `46d72c8321c65c53`.

No scores or acceptance assigned. Two NEW independent reviews remain parent-owned. No manual QA, subagents, merge, PR watch or reference acceptance.

## Source and repairs

Integrated Word Tiles phone precision, nine coarse regions below the board, direct blank-letter entry, and Battleship responsive setup / precise targeting. Preserved parent readiness updates and explicit native registrations. Source paths and worker handoffs are indexed; root implementation notes were preserved in excluded evidence and removed from the checkout.
Native integration repaired desktop blank-letter overlap from expanded Fit/Enlarge hit areas, empty-premium label contrast (cream text on pale background), the setup guidance selector, composite overview hit target, and Word Tiles score/viewport layout. Full pre-input bounds and corner-hit assertions remain, including blank-open context and near-seat score. Failed runs and images are retained.
Hosted b8c60f7 shard 2 exposed an absent full-layout ship selector on the production phone default. 439536df1 adds visible Ship/Region gestures and precise bow placement to live and custom-game automation. The literal regression failed before repair, then passed. No timeout, retry, mode override, readiness bypass or spec edit. The targeting consumer audit found no stale four-quadrant indices; retained full-map keyboard targets remain interactive.

## Separate verification verdicts

- Aggregate focused tasks: 96/96 passed. Repaired Battleship packages: 9/9 lint/typecheck/test tasks passed, including 43 component tests. ci:goals passed. See interactions/*final.log and consumer-package-logs.
- Full local catalog: bun verify once on final source, failed at `@libs/tools-harness-ts#ci:statecharts`: `/more/troubleshooting: no chart state owns the public route from libs/app-root-client-ts/src/route-table.ts`. Reported counts: [{'successful': 13, 'total': 13}, {'successful': 17, 'total': 19}]. No board spec edited. The public troubleshooting route requires ownership by its chart-owning change.
- Native checks: All 781 visual cases passed native readiness/play, browser-error and serious/critical axe stages. Eight font checks and the instrumented chess regression passed. Pixel comparisons, full bun verify, hosted safety and Ubuntu reference decisions are reported separately; no macOS references were accepted.
- Local pixels: `{"failureKinds": {"missing reference": 129, "pixel difference": 652}, "pixel": 781}`. No baseline or tolerance waiver.
- Hosted safety at receipt: verify:start: SUCCESS; verify:shards (0): SUCCESS; verify:shards (1): SUCCESS; verify:shards (2): SUCCESS; verify:shards (3): SUCCESS; verify:shards (4): SUCCESS; verify:shards (5): SUCCESS; verify:shards (6): SUCCESS; verify:end: SUCCESS; GitGuardian Security Checks: SUCCESS. Exact-head snapshot and logs in interactions/pr-final-status.json and hosted-run-*.
- Canonical Ubuntu: [42328035701](https://github.com/crvouga/gamezilla/actions/runs/42328035701), `in_progress: pending`, author `success`, compare `in_progress`. References not accepted automatically; pending or failed is not a pass.

## Media and audit

14 board families; 175 selected stories; 700 screenshots, light/dark at 390×844 and 1440×900; 692 immutable round-six before PNGs; 700 pairs. 8 new-state before images are absent and explicitly marked. Native desktop checks use 1440×844.
78 playable light-theme recordings for 39 journeys at both capture viewports. Each complete WebM has an assertion checkpoint log and intermediate frames. Exact checkpoint counts/durations are in journeys/recordings/video-manifest.json. Recorder pacing is automated, not human timing. Before/after human action counts are unknown, not inferred from assertions.
Round-six raw evidence remains immutable (8,217 manifest-bound files hash-checked). Before binding: source 863c687fae76c57527d495ec436afcf0ea99539a, media 60ff27e35a1a772884b05d9e64141fbebc42c73c, evidence 95e2cf5e91b0fcee.
The classifier audit corrected earlier axe failures mislabeled as pixel-only due to nearby code excerpts; interactions/classifier-audit.json contains prior and corrected counts. ARTIFACT_INDEX.md and artifact-inventory.json enumerate raw artifacts, including failed logs/images and superseded b8c60f7 results. archive-inventory.json records archive internals. Split verify diagnostics are reconstructable with ordered parts and SHA-256. No failed or interrupted native run is promoted to a final pass.

## Remaining limits

Two new independent parent reviews, reference acceptance decision, and any outstanding hosted/canonical outcomes remain separate gates. The known outside-board troubleshooting chart ownership failure remains. On superseded head 4e6fa4c19, hosted Quoridor Hill party/health stalled after a refused move; the preserved diagnosis distinguishes move progression from record visibility and documents unchanged round-six ownership. See interactions/outside-scope/QUORIDOR_HILL_HOSTED_DIAGNOSIS.md; exact attempted action and rebase order remain unknown. Numberlink republication was not rerun without a repair; the round-six diagnosis is retained under interactions/outside-scope. Board fixtures establish no live persistence, transport, full-match, lexicon-service or app-update recovery claim.

All 9967 recorded assertion checkpoints finished without a failed checkpoint. Cleanup receipt confirms clean source/media checkouts before the receipt-only commit and no remaining owned capture/native processes.

## Publication receipts

[Manifest](https://github.com/crvouga/gamezilla/blob/f05f61a51cd6961c7e5ae1883d3c9a1e6f384b0d/round-7/manifest.json) · [Gallery](https://github.com/crvouga/gamezilla/blob/f05f61a51cd6961c7e5ae1883d3c9a1e6f384b0d/round-7/GALLERY.md)
https://github.com/crvouga/gamezilla/pull/280#issuecomment-6701414273
https://github.com/crvouga/gamezilla/pull/280#issuecomment-6701414461
https://github.com/crvouga/gamezilla/pull/280#issuecomment-6701414688

publication-verification.json verifies exact comment bodies and pinned PNG/GIF/WebM bytes. publication-artifact-inventory.json indexes the receipt supplement; the original immutable manifest and media remain unchanged.

PR https://github.com/crvouga/gamezilla/pull/280, head b606946642616ea53bbf11e8b4fb23e08fb55c5f, checks and reviews verify:start: SUCCESS; verify:shards (0): SUCCESS; verify:shards (1): SUCCESS; verify:shards (2): SUCCESS; verify:shards (3): SUCCESS; verify:shards (4): SUCCESS; verify:shards (5): SUCCESS; verify:shards (6): SUCCESS; verify:end: SUCCESS; GitGuardian Security Checks: SUCCESS; two NEW independent reviews parent-owned.
