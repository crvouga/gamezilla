# Round-five handoff

PR: https://github.com/crvouga/gamezilla/pull/280
Source SHA: `d2ee6467e23b84ffd7b5128fb993a614df68a7d2`
Media SHA: `b69dc3f7f93ddd7467c2057b56a974e60178b410`
Evidence code: `1459fd0b37554c88`
Build SHA-256: `106c59d28b3d6f1e82a58e094b16727c162c13ade0f0ef0fe6be39d1ad540e86`

incomplete: independent reviews and verification limitations remain

All 752 visual cases passed native readiness/play, browser-error and serious/critical axe stages. Eight font checks and the instrumented chess regression passed. Pixel comparisons, full bun verify, hosted safety and Ubuntu reference decisions are reported separately; no macOS references were accepted.

## Source and integration

All intended worker changes and the integration fixes are committed. Ownership was reconciled against the actual diff and unique handoffs; the generic BOARD handoff and mislabeled chess/Pong handoffs were not used as authoritative source descriptions. See SOURCE_REVIEW.md and intended-source-paths.json.

Integration preserves saved puzzle completion separately from the current Sokoban board, including movement and restart after solving. Numberlink uses its existing enclosing Next/Pack controls. Shared desktop rails and phone chip facts are compact, Quoridor controls avoid wrapping, rack corners retain hit coverage, and fitted WordTiles workbench boards stay within the initial viewport while enlarged cells keep their precision size. Hosted follow-up repairs restore the exhaustive chess guidance-placement proof, all Numberlink/Sokoban saved-completion consumers and the accessible Pong rally status used by real physics journeys. Battleship secondary target tools retain pre-scroll viewport fit. Literal regressions and known-bug entries accompany the fixes. Readiness rows were updated.

## Automated verification

- **candidateSha:** d2ee6467e23b84ffd7b5128fb993a614df68a7d2
- **treeSha:** c2315ee28f2cf0058c8b6cfab286cf8eb50819c7
- **aggregate lint/typecheck/test:** PASS 96/96 on corrected head; aggregate-corrected-head.log
- **shared API consumers:** PASS 133/133 typecheck tasks on corrected head; consumer-typechecks-corrected-head.log
- **hosted fixes focused checks:** PASS 18/18; chess exhaustive proof, before/after guidance examples, Pong accessible rally status and saved-completion DOM regression
- **production release journeys:** FAIL overall 7 passed/1 failed. All five reported hosted journey regressions passed. Separate Numberlink republication title expected Canyon mw5ggq1r, observed Valley mw5ggq1r; unresolved, no retry/bypass. Run used the corrected runtime source before commit; hosted-fixes-release-verdict.json.
- **cache sync and Lingui:** PASS cache sync, extract and strict compile; followup logs
- **known-bug registry:** PASS ci:goals; goals-followup.log
- **canonical Storybook build:** PASS Node 8 GiB / Turbo concurrency 1; build-corrected-head.log
- **generated contracts:** PASS all selected story IDs and seven changed component contracts including shared-frame 10 stories; generated-contracts.json
- **Storybook full coverage:** FAIL 328: 255 missing visual references, 72 orphan references, 1 pre-existing demonstration-component contract. 81 selected-board/component violations, 246 other/retired families, 1 shared chess-screen contract; coverage-classification.json
- **full bun verify:** FAIL /more/troubleshooting has no chart-state owner. Full catalog selected 1540 tasks; 13/13 setup passed, 18/78 reported before halt; verify-corrected-head.log. Outside board scope; no invented spec.
- **native full matrix:** FAIL overall: 636 pixel differences and 116 missing references. All 752 native readiness/play/geometry/browser-error/serious-critical axe stages passed; 8 font checks and 1 instrumented chess regression passed. 761 total cases on corrected head; no native references accepted.
- **canonical Ubuntu:** PENDING comparison on exact d2ee6467e; authoring and public patch export steps succeeded, comparison in progress; run42294182190. No references accepted.
- **reviews:** Parent to commission two new independent reviews; no ratings assigned
- **hosted PR safety:** PASS verify:start, shards0–3 and verify:end on exact d2ee6467e; GitGuardian also success. PR remains draft; independent reviews pending.
- **media audit:** PASS 692 after PNGs and pairs, 74 native assertion recordings with completed checkpoints, zero checkpoint failures and at least two distinct frames each. Initial audit inventory failure retained; fixed exact manifest selection, byte-identical temporary copies only.

Native readiness/play, geometry, browser errors, accessibility and pixel outcomes are distinct. No macOS references were accepted. No assertion tolerances, retries, skips or specs were changed to suppress failures. The initial failing runs and the orchestration interruptions remain in interactions/. The first full matrix ran against an earlier dirty build; it is diagnostic evidence, not the final candidate verdict.

## Canonical Ubuntu

{
  "candidateSha": "d2ee6467e23b84ffd7b5128fb993a614df68a7d2",
  "status": "pending canonical comparison",
  "runUrl": "https://github.com/crvouga/gamezilla/actions/runs/42294182190",
  "runId": 42294182190,
  "authorAndCompareRequested": true,
  "referencesAccepted": false,
  "publicEncodedPatch": "Export step succeeded; finished-job log export pending. No bucket credentials accessed.",
  "priorRounds": "Round-four run42271653228 and round-three success do not bind this head; no prior patches applied",
  "observedAt": "2026-11-06T21:54:13.757466+00:00",
  "authorStatus": "success",
  "compareStatus": "in_progress",
  "jobId": 128155036176
}

## Media

173 selected stories across all 14 boards plus shared-frame and related component references; 692 after PNGs and 692 pairs against round-four before images. New states without a round-four predecessor are explicitly labeled.
74 videos cover 37 bounded journeys at phone 390×844 and desktop 1440×900. Screenshots cover both themes; native checks use 390×844 and 1440×844. Animated PR previews sample full recordings at 2 fps. Recorder pacing is automated, not natural user timing.

The immutable manifest includes build/media/log/script hashes, before-image binding, exact candidate IDs and per-board limits. Native pixel failures against older references are not reported as overall test passes.

## Per-board scope and remaining gaps

| Board | Native result | Remaining gap |
|---|---|---|
| ChessGameBoard | 40 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 40 failed; no macOS acceptance. | Promotion choice and board guidance are exercised; ordinary full-match and network turn progression are not established. |
| ChessPuzzleBoard | 29 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 29 failed; no macOS acceptance. | Puzzle fixture completion and wrong-move recovery; persisted attempt history and overview navigation remain outside this Storybook evidence. |
| ConnectFourGameBoard | 40 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 40 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| BattleshipSetupBoard | 35 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 35 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| BattleshipBoard | 47 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 47 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| NumberlinkPlayer | 38 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 38 failed; no macOS acceptance. | Pointer fixture recovery uses synthetic touch events with native pointer capture stubbed; trusted touch capture and shared undo/redo are not established here. Separate production cross-device and offline flows passed, but the republication-title scenario failed; see release verdict. |
| SokobanPlayer | 37 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 37 failed; no macOS acceptance. | Local production-rule history covers corner recovery, undo/redo, solving, restart and library callbacks. Separate production cross-device/offline flows passed; touch/swipe completion and every persisted history branch are not established. |
| QuoridorBoard | 51 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 51 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| QuoridorBoard | 43 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 43 failed; no macOS acceptance. | Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification. |
| WordTilesBoardView | 84 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 84 failed; no macOS acceptance. | Real resolveProposal/playEncoded fixture proves accepted CAT/score/turn, pass and exchange; retry is synchronous and does not prove asynchronous progress or live persistence. |
| WordTilesPuzzlePlayerView | 44 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 44 failed; no macOS acceptance. | Production placement evaluator proves retained draft retry and target completion; live lexicon loading and persisted attempts remain outside this evidence. |
| HeartsBoard | 56 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 56 failed; no macOS acceptance. | Real legal-card rules drive accepted pass and first trick with rotating identities; a full hand/match and network acknowledgement remain unproven. |
| PongBoardView | 48 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 48 failed; no macOS acceptance. | Controlled production-rule score/reconnect fixture. The separate real-physics production completion/rematch journey passed; live transport recovery is not established by this fixture. |
| LightCyclesBoardView | 72 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 72 failed; no macOS acceptance. | Production step rules drive collision, result, next round and resumed steering; live transport reconnection remains unproven. |

## Publication

- sourceSha: d2ee6467e23b84ffd7b5128fb993a614df68a7d2
- mediaSha: b69dc3f7f93ddd7467c2057b56a974e60178b410
- evidence_code: 1459fd0b37554c88
- comments: ['https://github.com/crvouga/gamezilla/pull/280#issuecomment-6696848801', 'https://github.com/crvouga/gamezilla/pull/280#issuecomment-6696849442', 'https://github.com/crvouga/gamezilla/pull/280#issuecomment-6696850031']
- manifest: https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/manifest.json
- gallery: https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/GALLERY.md
- canonicalRun: https://github.com/crvouga/gamezilla/actions/runs/42294182190

## Remaining ownership

The parent commissions two new independent reviews. No score was assigned. A human owns merging after required checks and reviews; this agent did not merge or watch the PR. The known /more/troubleshooting chart-ownership gap is outside board scope and was not given an invented spec. The earlier hosted offline Numberlink SQLite eight-second fallback cause remains unproven; no bypass or retry was added. Board fixtures do not establish live transport, persisted end-to-end flows, app updates or live lexicon service behavior.
