# Round-six handoff

PR: https://github.com/crvouga/gamezilla/pull/280
Candidate: `863c687fae76c57527d495ec436afcf0ea99539a`
Media: `60ff27e35a1a772884b05d9e64141fbebc42c73c`
Evidence code: `95e2cf5e91b0fcee`
Build SHA-256: `2ee4017c2c1836dae976a6f86b25c5053b5735071cb9328da7d08122091f555c`

incomplete: independent reviews and verification limitations remain

All 758 visual cases passed native readiness/play, browser-error and serious/critical axe stages. Eight font checks and the instrumented chess regression passed. Pixel comparisons, full bun verify, hosted safety and Ubuntu reference decisions are reported separately; no macOS references were accepted.

## Integration

Both implementation lanes and parent native assertions are committed with explicit owned paths. Start source is d2ee6467e23b84ffd7b5128fb993a614df68a7d2; round-five evidence 1459fd0b37554c88 and its media remain immutable. All 692 before PNG hashes were checked against that manifest. No worker edits were discarded. See SOURCE_REVIEW.md, intended-source-paths.json and the implementation handoffs under interactions/implementation/.
Four native integration defects received literal executable regressions and individual known-bug JSONs: redundant blank hit-area expansion; blank chooser pushing desktop precision below the fold; a two-row participant band pushing Hill confirmation below the fold; and full wrapped identities exceeding the retained metadata-height limit. Hill notation checks actual one-line text in a nonempty phone strip or desktop table. QuadSteering checks full text bounds before input. Map focus, selection retention and Escape recovery run natively. Locked setup omits editing guidance. Full original journey assertions remain. Geometry/accessibility/pixel limits were not weakened; no retries or reference acceptance were used.

## Verification

- Aggregate lint/typecheck/test: **96/96 passed** on final source content; aggregate-final.log.
- Regression registry, Lingui extraction/strict compile, exact-candidate Storybook build and generated contracts: **passed**.
- Full native matrix: **767 cases**; 758 visual cases passed readiness/play, browser-error and serious/critical axe. Eight font checks and one instrumented chess geometry regression passed. Pixel comparisons **failed**: {'pixel difference': 640, 'missing reference': 118}. No references accepted.
- Full Storybook coverage: **failed 328**, unchanged from round five: 81 selected board/component references, 246 other/retired families, one shared chess demonstration contract.
- **bun verify ran once on the final candidate and failed** at /more/troubleshooting: no chart state owns the public route. Setup 13/13; gate stage reported 17/20 before halt. Outside board scope; no specs edited. Full log and diagnostics archive are retained.
- Hosted PR safety: **passed on the exact candidate**, verify:start, six shards and verify:end. Run 42309514784 and full logs were read and retained. GitGuardian passed. PR remains draft.
- Chromatic published Storybook, but its log reports the billed snapshot limit and **no UI tests or UI review run**. The publication URL is partially masked in the public job log; no URL was invented and no visual approval is claimed.
- Extra tools-package --only diagnostic: **1083 passed / 53 failed**, in brand-artifact and agent-configuration checks outside board scope. Output retained; not repaired or represented as a board pass.
- Known Numberlink republication failure: **unresolved and not rerun without a repair**. The unchanged round-five diagnosis is retained at interactions/outside-scope/NUMBERLINK_REPUBLICATION_DIAGNOSIS.md. It is not marked passed, flaky, waived or proven pre-existing.
- Media audit: **692 after PNGs, 692 pairs and 78 complete recordings**. Every recording has finished assertion checkpoints, zero checkpoint failures and at least two distinct frames. Both screenshot themes, phone390×844 and desktop1440×900; native checks use desktop1440×844. Videos use light theme and automated pacing, not natural user timing.
Recorder recovery preserved 48 completed WebMs byte-for-byte. The inherited 500-checkpoint recording ceiling was raised to 2000 for the expanded blank-target assertions; read-only scalar assertion checkpoints reuse the prior frame while every assertion executes. The interrupted incomplete recording and original helper/log remain in interactions/recorder-interruption/. This changes evidence recording only, not native tests or product behavior.

## Canonical Ubuntu

Run: https://github.com/crvouga/gamezilla/actions/runs/42309542538
Observed status: **in_progress: pending**. Candidate: `863c687fae76c57527d495ec436afcf0ea99539a`. References accepted: **false**. Author: success; compare: success; Storybook job: success. Exact dispatch, step status and available logs are under ubuntu/. Superseded runs and their cancellation records remain clearly labeled; round-five Ubuntu success is not round-six evidence.

## Review inputs and artifact completeness

Start with REVIEW_INPUTS.md and ARTIFACT_INDEX.md. artifact-inventory.json indexes every captured evidence file by path, size and SHA-256; generated self-referential publication metadata is excluded explicitly. interactions/ARTIFACT_INDEX.md covers every raw failure/diagnostic/verification artifact. journeys/ARTIFACT_INDEX.md covers every recording, checkpoint image and checkpoint JSON. GALLERY.md links all stories in both viewports/themes and every pair. manifest.json binds media, verification outputs, scripts, source and build.
Prior failed and interrupted native runs are diagnostic evidence, never the final verdict. The complete final matrix, fonts and raw test artifacts are retained separately. No prior reviewer opinions or scores were used in this verification task. Parent owns two NEW independent reviews; no ratings or acceptance are assigned.

## Journey scope

| Journey | Board | Final native result | Remaining limit |
|---|---|---|---|
| J1 | ChessGameBoard | 40 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 40 failed; no macOS acceptance. | Promotion choice and board guidance are exercised; ordinary full-match and network turn progression are not established. |
| J2 | ChessPuzzleBoard | 29 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 29 failed; no macOS acceptance. | Puzzle fixture completion and wrong-move recovery; persisted attempt history and overview navigation remain outside this Storybook evidence. |
| J3 | ConnectFourGameBoard | 40 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 40 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| J4 | BattleshipSetupBoard | 35 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 35 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| J5 | BattleshipBoard | 47 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 47 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| J6 | NumberlinkPlayer | 38 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 38 failed; no macOS acceptance. | Pointer fixture recovery uses synthetic touch events with native pointer capture stubbed; trusted touch capture and shared undo/redo are not established here. Separate production cross-device and offline flows passed, but the republication-title scenario failed; see release verdict. |
| J7 | SokobanPlayer | 37 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 37 failed; no macOS acceptance. | Local production-rule history covers corner recovery, undo/redo, solving, restart and library callbacks. Separate production cross-device/offline flows passed; touch/swipe completion and every persisted history branch are not established. |
| J8 | QuoridorBoard | 51 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 51 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| J9 | QuoridorBoard | 45 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 45 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| J10 | WordTilesBoardView | 85 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 85 failed; no macOS acceptance. | Real resolveProposal/playEncoded fixture proves accepted CAT/score/turn, pass and exchange; retry is synchronous and does not prove asynchronous progress or live persistence. |
| J11 | WordTilesPuzzlePlayerView | 45 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 45 failed; no macOS acceptance. | Production placement evaluator proves retained draft retry and target completion; live lexicon loading and persisted attempts remain outside this evidence. |
| J12 | HeartsBoard | 56 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 56 failed; no macOS acceptance. | Real legal-card rules drive accepted pass and first trick with rotating identities; a full hand/match and network acknowledgement remain unproven. |
| J13 | PongBoardView | 48 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 48 failed; no macOS acceptance. | Controlled production-rule score/reconnect fixture. The separate real-physics production completion/rematch journey passed; live transport recovery is not established by this fixture. |
| J14 | LightCyclesBoardView | 73 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 73 failed; no macOS acceptance. | Production step rules drive collision, result, next round and resumed steering; live transport reconnection remains unproven. |

## Publication

- sourceSha: 863c687fae76c57527d495ec436afcf0ea99539a
- mediaSha: 60ff27e35a1a772884b05d9e64141fbebc42c73c
- evidence_code: 95e2cf5e91b0fcee
- manifest: https://github.com/crvouga/gamezilla/blob/60ff27e35a1a772884b05d9e64141fbebc42c73c/round-6/manifest.json
- gallery: https://github.com/crvouga/gamezilla/blob/60ff27e35a1a772884b05d9e64141fbebc42c73c/round-6/GALLERY.md
- canonicalRun: https://github.com/crvouga/gamezilla/actions/runs/42309542538
- https://github.com/crvouga/gamezilla/pull/280#issuecomment-6699238532
- https://github.com/crvouga/gamezilla/pull/280#issuecomment-6699238994
- https://github.com/crvouga/gamezilla/pull/280#issuecomment-6699239407

No manual QA, subagents, merge, watch or unwatch. Source checkout is clean; owned capture/test processes are stopped before final handback. No live transport, persisted full-match, app-update or live lexicon-service claim follows from board fixtures.

## Publication-time canonical result

The workflow subsequently completed **successfully**, including the Storybook and final diagnostic jobs. Both authoring and comparison reported **767 passed**. See `canonical-publication-status.json`; the immutable media manifest intentionally preserves its earlier observed workflow-pending status. No references were accepted.
