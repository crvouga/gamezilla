# Numberlink republication diagnosis

Candidate: `d2ee6467e23b84ffd7b5128fb993a614df68a7d2` — https://github.com/crvouga/gamezilla/pull/280

## Verdict and ownership

The observed failure is Alice opening an old published edition after a successful publication action. It is **not an observed failure of Bob retaining his old pack**, and the expectation that Alice sees Canyon is correct. The leading diagnosis is a shared puzzle-publication navigation/reactive-read race, outside the requested board scope. Exact causality remains unproved: the retained evidence does not include publication arguments, returned row bodies, or the edition ID selected by the click. A draft-selection/save defect remains possible. There is no evidence establishing a board integration regression, but source separation alone cannot prove the board changes had no timing effect. Do not mark this preexisting, flaky, passed, or waived.

No tests, builds, retries, source edits, commits, agents, or reference acceptance were performed. Only this unique diagnosis file was written. Source was clean at inspection and HEAD matched the candidate. Existing handoff and evidence were left intact for the two reviewers.

## Exact failing transition

Evidence below refers to `../interactions/hosted-fixes-release-journeys.log` (line numbers are one-based).

1. `specs/journeys/numberlink-packs.feature:17–19`: scenario “An earlier Numberlink pack stays playable after a new publication”. The failed step is **When Alice republishes Numberlink after Bob has started her pack**. The subsequent Then was not executed (log 678–693).
2. `libs/runtime-harness-ts/src/numberlink-revision-journey.ts:45–52` returns Alice to the library, opens the first source document's draft, enters `Canyon mw5ggq1r` in `content-title`, enters `B` in `numberlink-pair-label`, and calls `publishJourneyDraft`.
3. `libs/game-puzzle-harness-ts/src/content-journey-authoring.ts:45–58` validates, waits for validation, publishes, waits for **Publication saved**, clicks **View published edition**, then checks `content-edition` for Canyon. The last check times out after 20,000 ms. Because execution reached it, all preceding awaited operations completed.
4. Host snapshot (log 664–666): account `ca81e5cc-010c-495b-a34e-b894e6260659`, device `3610fbac-71b1-4542-998a-e6f3de758300`, screen `puzzle-content-edition`, **Valley mw5ggq1r**, endpoints **A A**, and “Edit working draft”. Both the title and drawing look like the earlier edition; this is stronger evidence for opening the old edition than a title-only rendering defect.
5. Peer snapshot (667–669): Bob remains on `puzzle-content-attempt`, **Valley mw5ggq1r**, puzzle 1 of 2 in **Rivers mw5ggq1r**, one connected pair, 3/9 covered cells, two saved positions. This is consistent with retaining the original attempt, but is not a substitute for the unexecuted identity assertions.
6. The new-edition identity and endpoint-B checks in `reviseNumberlinkJourney`, and the later old-attempt/source/pack identity assertions, never execute. Do not infer those passed.

## Request and trace evidence

Scenario request-start window in the retained trace summary: **2026-11-06T20:58:37.300Z–20:59:04.962Z** (log 1022). Browser request IDs bind the final authoring sequence:

- Log 508: `69636.204`, `savePuzzleContentDraft`; HTTP 200 at 516, one `applied` verdict at 579.
- Log 517: `69636.207`, ordered batch `savePuzzleContentDraft`, `validatePuzzleContentDraft`, `publishPuzzleContent`; HTTP 200 at 521, three `applied` verdicts at 582, topics `system:game-puzzle-content` and Alice's user topic.
- Log 519: `69636.208` already queries the edition/attempt scopes **before** the upload response at 521. This is consistent with local publication success/navigation preceding server acknowledgement; it does not by itself prove a bug.
- Logs 522–524 and 583–584: edition-scope hydration requests 208/209 complete successfully, with one revision in the edition scope. Response summaries contain counts, not IDs/titles. Subsequent hydration therefore does not establish which edition was selected or published.
- The narrowed trace output at 1020–1272 includes server traces `27702a5e23b7486f4bfae183601c3eb6` and `0157817ad894deb095e8f48b93adeb63`, with related client traces `8ef023089b1c3c930538617c4b444f92` and `d5b8102b2173fbb51bf81251409c6e9d`. These are startup/profile/space work, not the failing publication. The log explicitly limits evidence to completed/exported spans. No publication replay details can honestly be inferred from them.

The supplied release verdict says dirty followup on base `05122f90dcfd6aee60d619015337420ea8f76ebb`; trace build attributes also name that base. HANDOFF states this was the corrected source before committing candidate d2ee6467e. Preserve that provenance distinction: this is the retained integration run associated with the candidate, not an independently executed clean-commit run.

The debug-trace CLI was consulted before source diagnosis. `bun obs find mw5ggq1r` resolved to the absent checkout `.observability`, UTC range 2026-11-05T22:00:12.617Z–2026-11-06T22:00:12.617Z, and returned no match. The retained `numberlink-publication-observability.log` likewise searched the old localhost-stack source and found no match. A search located only `libs/runtime-harness-ts/.cache/harness-report/all/traces/spans.69135*.ndjson`; the matching scenario query against that source (UTC range 2026-11-05T22:00:38.617Z–2026-11-06T22:00:38.617Z) returned no scenario match, and those files contain neither of the matching release server trace IDs. These unrelated traces are not evidence for this failure. The embedded release log is the available matching trace artifact.

## Code explanation and repair recommendation

The harness expectation agrees with `specs/puzzles/publish-puzzles.feature:34–39`: republishing makes the chosen draft current while preserving the earlier edition. Canyon is checked on **Alice's new publication**, not Bob's intentionally unchanged pack. Changing this expectation to Valley would hide the failure.

`libs/game-puzzle-client-ts/src/use-content-publication.tsx:40–67` saves the writer, validates/publishes its draft ID, and returns after local mutation success. `content-publication-controls.tsx:90–98` enables publication viewing whenever any publication exists and chooses `props.document.published_revision_id` at click time. On a previously published document that value can still name Valley while independent SQL watches catch up. Opening the edition pins a revision ID; later updates to the document's latest-publication pointer need not move an already-open edition. That mechanism explains the persistent Valley/A view despite applied writes and subsequent successful hydration.

This is a **hypothesis supported by source and event ordering**, not a proven trace reconstruction. In particular `publish-content-mutation.ts` treats an existing revision ID as an idempotent no-op, so an `applied` verdict alone does not prove a new Canyon revision was created. Missing mutation arguments and selected revision ID prevent excluding that alternative.

Smallest recommended repair, if the stale-pointer mechanism is confirmed: bind “View published edition” after successful publication to the exact draft/revision ID just published, or withhold that action until the observed publication pointer equals that ID. Keep explicit navigation and old editions intact. Own this in **shared `@libs/game-puzzle-client-ts` publication controls**, with `@libs/game-puzzle-shared-ts` / sync owners involved only if evidence instead shows wrong saved/replayed rows. Do not change Numberlink board rendering, increase timeouts, add harness waits that mask a clickable wrong destination, or weaken the title assertion.

Before implementing, pin a deterministic regression: initially published Valley/A; save Canyon/B; successfully publish; delay reactive document projection while clicking View; assert the new revision and title/drawing open and the old pack still retains Valley/A. Include the literal observed input and a dedicated known-bug entry when authorized to fix. The current read-only task authorizes neither that test nor the repair. If the retained full publication payload/selected-ID artifacts can be recovered, inspect them first; otherwise this exact mechanism needs the targeted regression rather than another full journey retry.

Source provenance: the PR diff against local merge-base `70536e4275f478b147b94492d9c724ea3186a511` does not change the author screen, draft-save hook, publication controls, publication hook, or Numberlink republication journey. Publication controls/hook last changed at `56555338ebaba46fcec38d35535be9ce032b7ff5`. The candidate followup diff from 05122 does not change these paths either. The shared client entrypoint adds library navigation, and player/attempt changes exist, so this is evidence for ownership separation, **not proof that this failure existed before the PR**. No earlier identical failing run was established.

## Canonical Ubuntu and PR status

Read canonical run **42294182190 once** through the GitHub API (attempt 1): `head_sha=d2ee6467e23b84ffd7b5128fb993a614df68a7d2`, `status=in_progress`, `conclusion=null`; created 2026-11-06T21:08:04Z, updated 21:08:08Z. https://github.com/crvouga/gamezilla/actions/runs/42294182190 . No second status read, no reference acceptance, no patch application. This is pending, not a pass.

Separate PR metadata read: head d2ee6467e; draft=true; reviewDecision empty; verify:start, shards 0–3, verify:end and GitGuardian all completed SUCCESS. The integration release journey verdict remains **7 passed / 1 failed**. Independent reviewers' results were not read or inferred. The handoff's broader verification limitations remain in force.

## Evidence integrity

SHA-256 at inspection:

- `interactions/hosted-fixes-release-journeys.log`: `57c458f6294455af4914ed9e48e15e85b82b3cb7add329b9c5084a6b76c25069`
- `interactions/hosted-fixes-release-verdict.json`: `f2da0c3d585e45f8470363a9f8c58ebb932d46ee8447dc32d7490a13665155c3`
- `interactions/numberlink-publication-observability.log`: `8218f396f481f44648c66a84ca4889282908e2aa43cba23286160e36c03f3676`

PR https://github.com/crvouga/gamezilla/pull/280, head d2ee6467e23b84ffd7b5128fb993a614df68a7d2, checks: hosted safety SUCCESS; integration journeys FAIL 7/1; canonical Ubuntu IN_PROGRESS at one read; reviews pending per handoff, no review decision, PR draft.
