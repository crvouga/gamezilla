# Quoridor Hill hosted blocker on 4e6fa4c19

Observed job: https://github.com/crvouga/gamezilla/actions/runs/42324714376/job/128257766264. Raw log: ../../shard-0-4e6fa4c.log. No rerun, timeout increase, retry addition or assertion change was made.

Both two-people/two-bots completion and Hill health stop inside playPartyMove waiting 20 seconds for `custom-game-review-move-***7`. GitHub masking obscures the complete numeric identifier; it is not asserted as known.

At lines 2472 and 2730 (host snapshots), the product says “That didn't go through” and “That move is not legal in this position.” Both host and peer show the same pawn positions: South f4, West c6, North e6, East f5, South to move. The host offers legal move controls; peer is read-only because it is South's turn. Both pages are visible at width390/height757. This is evidence of a rejected proposal / stalled move progression, not merely proof of a completed move hidden by collapsed history. The log does not expose the attempted action or serialized chosen/latest public state at this acceptance wait, so the exact rebase ordering is unknown.

The observed position matches the existing literal 16-action Hill regression in libs/runtime-harness-ts/tests/custom-game-party-journey.test.ts: e2,b5,e8,h5,e3,c5,e7,g5,e4,d4h,e5v,c5v,f4,c6,e6,f5. That test already distinguishes legal f6 from occupied f5. Existing known-bug party-journey-chooses-before-bot-rebase documents provisional g6 vs authoritative f5, and custom-game-party-turn.ts handles same-ply replacement. The hosted symptoms are consistent with that boundary, but the captured log does not establish which action was chosen; no speculative repair was applied.

Ownership: runtime party journey / authoritative custom-game bot reconciliation, with the acceptance wait in libs/runtime-harness-ts/src/custom-game-party-turn.ts. quoridor-source-comparison.json proves the journey, turn adapter, Quoridor automation/board, and custom-game public/render state files are byte-identical to round6 source863c687fa. Round7's shared-frame CSS only changes gaps under :has([data-measure="compact"]), a Word Tiles workspace condition; it does not change Hill move proposals, review records, or bot authority. No introduced round7 board regression is established here.

Hosted safety remains failed on this candidate. Native fixture checks and media cannot establish a live persisted Hill completion. Keep the original terminal-outcome assertions and investigate the chosen/authoritative snapshot boundary in the owning work; do not turn this failure into a visibility waiver or retry.

## Later exact-head observation

Hosted shard 0 passed on b606946642616ea53bbf11e8b4fb23e08fb55c5f (run42327968060, job128268147448). The intervening source repair only changes Word Tiles Fit/Enlarge target spacing. This is a later successful safety observation, not evidence that the earlier Hill refusal cause was repaired. The original failed log and uncertain proposal/rebase boundary remain retained.
